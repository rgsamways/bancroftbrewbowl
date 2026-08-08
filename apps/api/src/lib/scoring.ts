import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import type { RulesConfig } from "@bbb/shared";

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
 * back rather than applied automatically — the rules' tiebreaker needs real
 * playoff data we don't have, so an admin resolves it manually.
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
    results.push(await scorePoolForGame(pool, game));
  }
  return results;
}

async function scorePoolForGame(
  pool: typeof pools.$inferSelect,
  game: typeof games.$inferSelect
): Promise<ScoreGamePoolResult> {
  const rules = pool.rules as RulesConfig;

  const weekPicks = await db.query.picks.findMany({
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
    await db.update(picks).set({ result: pickResult }).where(eq(picks.id, pick.id));
  }

  const entriesToEliminate = gamePicks.filter((pick) => {
    if (pick.teamCode === winningTeam) return false;
    if (game.result === "tie") return rules.tie_counts_as === "elimination";
    return true;
  });

  const aliveEntries = await db.query.entries.findMany({
    where: and(eq(entries.poolId, pool.id), eq(entries.status, "alive")),
  });
  const wouldWipeOutPool = entriesToEliminate.length >= aliveEntries.length;

  if (wouldWipeOutPool) {
    return {
      poolId: pool.id,
      scored: gamePicks.length,
      eliminated: 0,
      wipeout: true,
      pendingEliminationEntryIds: entriesToEliminate.map((pick) => pick.entryId),
    };
  }

  for (const pick of entriesToEliminate) {
    await db
      .update(entries)
      .set({ status: "eliminated", eliminatedWeek: game.weekNumber })
      .where(eq(entries.id, pick.entryId));
  }

  return { poolId: pool.id, scored: gamePicks.length, eliminated: entriesToEliminate.length, wipeout: false };
}
