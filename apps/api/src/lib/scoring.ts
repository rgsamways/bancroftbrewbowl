import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks, pools, wipeoutEvents } from "../db/schema.js";
import type { SurvivorRulesConfig } from "@bbb/shared";

type ScoreGamePoolResult = {
  poolId: string;
  scored: number;
  eliminated: number;
  wipeout: boolean;
  pendingEliminationEntryIds?: string[];
};

/**
 * Resolves every pick tied to a game once its result is known, then applies
 * eliminations — for every pool running that same NFL season, since a game's
 * result is shared across all of them (see the `games` table comment).
 * If resolving this game would eliminate every remaining alive entry in a
 * pool for this week (a "wipeout" week), that pool's eliminations are held
 * back and persisted to `wipeoutEvents` rather than applied automatically —
 * the rules' tiebreaker needs real playoff data we don't have, so an admin
 * resolves it manually via POST /pools/:poolId/wipeouts/:wipeoutId/resolve.
 */
export async function scoreGame(gameId: string): Promise<ScoreGamePoolResult[]> {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game) throw new Error("Game not found");
  if (game.result === "pending") throw new Error("Game has no result yet");

  const affectedPools = await db.query.pools.findMany({
    where: eq(pools.seasonYear, game.seasonYear),
  });

  const results: ScoreGamePoolResult[] = [];
  for (const pool of affectedPools) {
    // One transaction per pool (not across the whole loop) — pools are
    // independent, so a failure scoring one shouldn't roll back another.
    if (pool.type === "survivor") {
      results.push(await db.transaction((tx) => scoreSurvivorPool(tx, pool, game)));
    } else {
      results.push(await db.transaction((tx) => scorePickEmPool(tx, pool, game)));
    }
  }
  return results;
}

type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Resolves every pick tied to this game for this pool to win/loss/tie and
 * writes the result — the only part of scoring that's identical regardless
 * of pool type. What happens after (elimination vs. nothing, since pick 'em
 * points are derived from `picks.result` at read time rather than stored)
 * is entirely type-specific. */
async function markGamePicks(tx: TxLike, pool: typeof pools.$inferSelect, game: typeof games.$inferSelect) {
  const weekPicks = await tx.query.picks.findMany({
    where: eq(picks.weekNumber, game.weekNumber),
    with: { entry: true },
  });

  const gamePicks = weekPicks.filter(
    (pick) =>
      pick.entry.poolId === pool.id &&
      (pick.teamCode === game.homeTeam || pick.teamCode === game.awayTeam)
  );

  const winningTeam =
    game.result === "home_win" ? game.homeTeam : game.result === "away_win" ? game.awayTeam : null;

  for (const pick of gamePicks) {
    const pickResult =
      game.result === "tie" ? "tie" : pick.teamCode === winningTeam ? "win" : "loss";
    await tx.update(picks).set({ result: pickResult }).where(eq(picks.id, pick.id));
  }

  return { gamePicks, winningTeam };
}

/** Pick 'em has no elimination and stores no running total — standings are
 * computed live from `picks.result` (see computePickEmPoints in
 * routes/entries.ts), so once results are written there's nothing further
 * to do here. This also makes re-scoring a corrected result self-correcting,
 * unlike survivor's elimination state. */
async function scorePickEmPool(
  tx: TxLike,
  pool: typeof pools.$inferSelect,
  game: typeof games.$inferSelect
): Promise<ScoreGamePoolResult> {
  const { gamePicks } = await markGamePicks(tx, pool, game);
  return { poolId: pool.id, scored: gamePicks.length, eliminated: 0, wipeout: false };
}

async function scoreSurvivorPool(
  tx: TxLike,
  pool: typeof pools.$inferSelect,
  game: typeof games.$inferSelect
): Promise<ScoreGamePoolResult> {
  const rules = pool.rules as SurvivorRulesConfig;

  const { gamePicks, winningTeam } = await markGamePicks(tx, pool, game);

  const losingPicks = gamePicks.filter((pick) => {
    if (pick.teamCode === winningTeam) return false;
    if (game.result === "tie") return rules.tie_counts_as === "elimination";
    return true;
  });

  // Mulligans: consumed per losing pick, not per week — a double-pick-week
  // entry that loses both picks will burn a mulligan on whichever loss is
  // scored first. Uses an atomic conditional UPDATE (not read-then-write)
  // so two games in the same week scored close together can't both see the
  // same stale mulligan count and both consume it.
  const survivedByMulligan = new Set<string>();
  if (rules.mulligans_allowed > 0) {
    for (const pick of losingPicks) {
      if (pick.entry.status !== "alive") continue;
      const [saved] = await tx
        .update(entries)
        .set({ mulligansUsed: sql`${entries.mulligansUsed} + 1` })
        .where(
          and(
            eq(entries.id, pick.entryId),
            eq(entries.status, "alive"),
            lt(entries.mulligansUsed, rules.mulligans_allowed)
          )
        )
        .returning();
      if (saved) survivedByMulligan.add(pick.entryId);
    }
  }

  // Dedupe: a double-pick entry can appear twice in `losingPicks` if it
  // picked both teams facing each other in this same game.
  const entriesToEliminateIds = [
    ...new Set(
      losingPicks
        .filter((pick) => pick.entry.status === "alive" && !survivedByMulligan.has(pick.entryId))
        .map((pick) => pick.entryId)
    ),
  ];

  const aliveEntries = await tx.query.entries.findMany({
    where: and(eq(entries.poolId, pool.id), eq(entries.status, "alive")),
  });
  const wouldWipeOutPool =
    entriesToEliminateIds.length > 0 && entriesToEliminateIds.length >= aliveEntries.length;

  if (wouldWipeOutPool) {
    await tx
      .insert(wipeoutEvents)
      .values({
        poolId: pool.id,
        weekNumber: game.weekNumber,
        gameId: game.id,
        candidateEntryIds: entriesToEliminateIds,
      })
      .onConflictDoUpdate({
        target: [wipeoutEvents.poolId, wipeoutEvents.gameId],
        targetWhere: sql`${wipeoutEvents.resolvedAt} IS NULL`,
        set: { candidateEntryIds: entriesToEliminateIds },
      });

    return {
      poolId: pool.id,
      scored: gamePicks.length,
      eliminated: 0,
      wipeout: true,
      pendingEliminationEntryIds: entriesToEliminateIds,
    };
  }

  for (const entryId of entriesToEliminateIds) {
    await tx
      .update(entries)
      .set({ status: "eliminated", eliminatedWeek: game.weekNumber })
      .where(eq(entries.id, entryId));
  }

  return {
    poolId: pool.id,
    scored: gamePicks.length,
    eliminated: entriesToEliminateIds.length,
    wipeout: false,
  };
}
