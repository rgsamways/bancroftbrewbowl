import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  rankOf,
  type JoinablePool,
  type MeSummary,
  type PickEmRulesConfig,
  type PickSheet,
  type SummaryEntry,
  type SurvivorRulesConfig,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import { requireEntryOwner, requireSession } from "../lib/guards.js";
import { deriveEntryState, loadSeasonWeeks, picksNeededFor, type SeasonWeek } from "../lib/entry-state.js";
import { computePickEmPoints } from "./entries.js";

type PoolRow = typeof pools.$inferSelect;

function doublePickWeeks(pool: PoolRow): number[] {
  return pool.type === "survivor" ? (pool.rules as SurvivorRulesConfig).double_pick_weeks : [];
}

function countsTie(pool: PoolRow) {
  return pool.type === "pick_em" && (pool.rules as PickEmRulesConfig).tie_handling === "everyone_correct";
}

/** Home and the Pick screen each get everything they need in one request. */
export async function homeRoutes(fastify: FastifyInstance) {
  fastify.get("/me/summary", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const now = new Date();

    const mine = await db.query.entries.findMany({
      where: eq(entries.userId, session.user.id),
      orderBy: [asc(entries.createdAt)],
      with: { pool: true },
    });

    const joinedPoolIds = new Set(mine.map((e) => e.poolId));
    const openPools = await db.query.pools.findMany({ orderBy: [asc(pools.createdAt)] });
    const joinablePools: JoinablePool[] = openPools
      .filter((p) => p.status !== "completed" && !joinedPoolIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, type: p.type, seasonYear: p.seasonYear }));

    if (mine.length === 0) {
      const empty: MeSummary = { serverNow: now.toISOString(), entries: [], joinablePools };
      reply.send(empty);
      return;
    }

    const poolIds = [...joinedPoolIds];
    const weeksBySeason = await loadSeasonWeeks([...new Set(mine.map((e) => e.pool.seasonYear))]);

    // Everyone in these pools: only counts, ranks and the champion's name leave the server.
    const poolEntries = await db.query.entries.findMany({
      where: inArray(entries.poolId, poolIds),
      with: { user: true },
    });
    const myPicks = await db.query.picks.findMany({ where: inArray(picks.entryId, mine.map((e) => e.id)) });

    const pointsByPool = new Map<string, Map<string, number>>();
    for (const pool of mine.map((e) => e.pool)) {
      if (pool.type !== "pick_em" || pointsByPool.has(pool.id)) continue;
      const ids = poolEntries.filter((e) => e.poolId === pool.id).map((e) => e.id);
      pointsByPool.set(
        pool.id,
        await computePickEmPoints(ids, (pool.rules as PickEmRulesConfig).tie_handling)
      );
    }

    const nameOf = (e: (typeof poolEntries)[number]) => e.user?.name ?? e.invitedName ?? "A player";

    const summaryEntries: SummaryEntry[] = mine.map((entry) => {
      const pool = entry.pool;
      const weeks = weeksBySeason.get(pool.seasonYear);
      const entryPicks = myPicks.filter((p) => p.entryId === entry.id);
      const derived = deriveEntryState({
        entryStatus: entry.status,
        poolStatus: pool.status,
        weeks,
        picksMadeThisWeek: (w) => entryPicks.filter((p) => p.weekNumber === w).length,
        picksNeeded: (w: SeasonWeek) => picksNeededFor(pool.type, doublePickWeeks(pool), w),
        now,
      });

      const inPool = poolEntries.filter((e) => e.poolId === pool.id);
      const points = pointsByPool.get(pool.id);
      const weekNumber = derived.week?.weekNumber ?? null;
      const thisWeekPicks = weekNumber === null ? [] : entryPicks.filter((p) => p.weekNumber === weekNumber);

      let champion: string | null = null;
      if (derived.state === "season_over") {
        if (pool.type === "survivor") {
          const alive = inPool.filter((e) => e.status === "alive");
          champion = alive.length === 1 ? nameOf(alive[0]!) : null;
        } else if (points) {
          const best = Math.max(...inPool.map((e) => points.get(e.id) ?? 0));
          const leaders = inPool.filter((e) => (points.get(e.id) ?? 0) === best);
          champion = leaders.length === 1 && inPool.length > 0 ? nameOf(leaders[0]!) : null;
        }
      }

      const myPoints = points?.get(entry.id) ?? 0;
      const ranked = points ? rankOf(myPoints, inPool.map((e) => points.get(e.id) ?? 0)) : null;

      return {
        entryId: entry.id,
        poolId: pool.id,
        poolName: pool.name,
        poolType: pool.type,
        seasonYear: pool.seasonYear,
        status: entry.status,
        eliminatedWeek: entry.eliminatedWeek,
        state: derived.state,
        weekNumber,
        lockTime: derived.week ? derived.week.lockTime.toISOString() : null,
        picksMade: derived.picksMade,
        picksNeeded: derived.picksNeeded,
        playersTotal: inPool.length,
        playersLeft: pool.type === "survivor" ? inPool.filter((e) => e.status === "alive").length : null,
        points: pool.type === "pick_em" ? myPoints : null,
        rank: ranked?.rank ?? null,
        tied: ranked?.tied ?? false,
        gamesTotal: pool.type === "pick_em" ? (derived.week?.gamesTotal ?? null) : null,
        correctThisWeek:
          pool.type === "pick_em"
            ? thisWeekPicks.filter((p) => p.result === "win" || (p.result === "tie" && countsTie(pool))).length
            : null,
        champion,
      };
    });

    const body: MeSummary = { serverNow: now.toISOString(), entries: summaryEntries, joinablePools };
    reply.send(body);
  });

  fastify.get("/entries/:entryId/pick-sheet", async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const owned = await requireEntryOwner(request, reply, entryId);
    if (!owned) return;
    const { entry } = owned;
    const now = new Date();

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear);
    const entryPicks = await db.query.picks.findMany({
      where: eq(picks.entryId, entry.id),
      orderBy: [asc(picks.weekNumber), asc(picks.createdAt)],
    });
    const derived = deriveEntryState({
      entryStatus: entry.status,
      poolStatus: pool.status,
      weeks,
      picksMadeThisWeek: (w) => entryPicks.filter((p) => p.weekNumber === w).length,
      picksNeeded: (w) => picksNeededFor(pool.type, doublePickWeeks(pool), w),
      now,
    });

    // An eliminated entry or a finished season has no week to pick in; the pick history is
    // still returned.
    const week = derived.week;
    const weekGames = week
      ? await db.query.games.findMany({
          where: and(eq(games.seasonYear, pool.seasonYear), eq(games.weekNumber, week.weekNumber)),
          orderBy: [asc(games.kickoffTime), asc(games.homeTeam)],
        })
      : [];

    const usedTeams: Record<string, number> = {};
    for (const p of entryPicks) {
      if (p.weekNumber !== week?.weekNumber) usedTeams[p.teamCode] = p.weekNumber;
    }

    const sheet: PickSheet = {
      serverNow: now.toISOString(),
      entryId: entry.id,
      poolId: pool.id,
      poolName: pool.name,
      poolType: pool.type,
      seasonYear: pool.seasonYear,
      status: entry.status,
      eliminatedWeek: entry.eliminatedWeek,
      state: derived.state,
      weekNumber: week?.weekNumber ?? null,
      lockTime: week ? week.lockTime.toISOString() : null,
      limit: derived.picksNeeded || 1,
      allowRepeatTeams: pool.type === "pick_em" || (pool.rules as SurvivorRulesConfig).allow_repeat_teams,
      games: weekGames.map((g) => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        kickoffTime: new Date(g.kickoffTime).toISOString(),
        result: g.result,
      })),
      picks: entryPicks.map((p) => ({ weekNumber: p.weekNumber, teamCode: p.teamCode, result: p.result })),
      usedTeams,
    };
    reply.send(sheet);
  });
}
