import type { FastifyInstance } from "fastify";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AdminGame, AdminNextStep, AdminPoolLine, AdminSummary, AdminWipeout } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, pools, wipeoutEvents } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { currentWeek, loadSeasonWeeks } from "../lib/entry-state.js";

/** The one next step, in priority order: no schedule at all; a wipeout decision (it holds back
 * standings); results for games that have kicked off; the season being complete; otherwise
 * caught up. */
export function chooseNextStep(input: {
  seasonYear: number | null;
  wipeouts: AdminWipeout[];
  waitingGames: AdminGame[];
  hasCurrentWeek: boolean;
}): AdminNextStep {
  if (input.seasonYear === null) return { kind: "no_schedule" };
  if (input.wipeouts.length > 0) return { kind: "wipeout", wipeout: input.wipeouts[0]! };
  if (input.waitingGames.length > 0) return { kind: "results", waiting: input.waitingGames };
  if (!input.hasCurrentWeek) return { kind: "season_complete" };
  return { kind: "caught_up" };
}

/** Everything the admin "Next step" screen needs, with the next step chosen here so the rule is
 * tested in one place: a wipeout decision first (it holds back standings), then results for
 * games that have kicked off, otherwise caught up. */
export async function adminSummaryRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/summary", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const now = new Date();

    // The current season is the latest one that has games.
    const [latest] = await db.select({ year: sql<number>`max(${games.seasonYear})::int` }).from(games);
    const seasonYear = latest?.year ?? null;
    const weeks = seasonYear === null ? [] : ((await loadSeasonWeeks([seasonYear])).get(seasonYear) ?? []);
    const week = currentWeek(weeks);

    let weekGames: (typeof games.$inferSelect)[] = [];
    if (seasonYear !== null && week) {
      weekGames = await db.query.games.findMany({
        where: and(eq(games.seasonYear, seasonYear), eq(games.weekNumber, week.weekNumber)),
        orderBy: [asc(games.kickoffTime), asc(games.homeTeam)],
      });
    }
    const toGame = (g: typeof games.$inferSelect): AdminGame => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      kickoffTime: new Date(g.kickoffTime).toISOString(),
    });
    // Waiting = has kicked off and has no result. A game still to be played is not waiting.
    const waitingGames = weekGames.filter((g) => g.result === "pending" && new Date(g.kickoffTime) <= now).map(toGame);

    // Pools, with alive and total counts.
    const allPools = await db.query.pools.findMany({ orderBy: [asc(pools.createdAt)] });
    const counts = await db
      .select({
        poolId: entries.poolId,
        total: sql<number>`count(*)::int`,
        alive: sql<number>`(count(*) filter (where ${entries.status} = 'alive'))::int`,
      })
      .from(entries)
      .groupBy(entries.poolId);
    const countOf = new Map(counts.map((c) => [c.poolId, c]));
    const poolLines: AdminPoolLine[] = allPools.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      seasonYear: p.seasonYear,
      alive: countOf.get(p.id)?.alive ?? 0,
      total: countOf.get(p.id)?.total ?? 0,
    }));

    // Wipeout decisions still waiting, in any pool.
    const open = await db.query.wipeoutEvents.findMany({
      where: isNull(wipeoutEvents.resolvedAt),
      orderBy: [asc(wipeoutEvents.createdAt)],
      with: { pool: true, game: true },
    });
    const wipeouts: AdminWipeout[] = open.map((e) => ({
      wipeoutId: e.id,
      poolId: e.poolId,
      poolName: e.pool.name,
      weekNumber: e.weekNumber,
      game: e.game ? { homeTeam: e.game.homeTeam, awayTeam: e.game.awayTeam } : null,
      candidates: e.candidateEntryIds.length,
    }));

    const next = chooseNextStep({ seasonYear, wipeouts, waitingGames, hasCurrentWeek: week !== null });

    const body: AdminSummary = {
      serverNow: now.toISOString(),
      scheduleLoaded: seasonYear !== null,
      seasonYear,
      weekNumber: week?.weekNumber ?? null,
      weekGamesTotal: weekGames.length,
      weekGamesEntered: weekGames.filter((g) => g.result !== "pending").length,
      lockTime: week ? week.lockTime.toISOString() : null,
      locked: week ? now >= week.lockTime : false,
      waitingGames,
      wipeouts,
      pools: poolLines,
      hasSurvivorPool: allPools.some((p) => p.type === "survivor" && p.seasonYear === seasonYear),
      next,
    };
    reply.send(body);
  });
}
