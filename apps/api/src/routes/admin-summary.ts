import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { AdminRequestLine, AdminGame, AdminNextStep, AdminPoolLine, AdminSummary, AdminWipeout } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminRequests, entries, games, pools, wipeoutEvents } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { otherAdmins } from "../lib/admin-requests.js";
import { currentWeek, loadSeasonWeeks } from "../lib/entry-state.js";

/** The one next step, in priority order: no schedule at all; a wipeout decision (it holds back
 * standings); results for games that have kicked off; the season being complete; otherwise
 * caught up. */
export function chooseNextStep(input: {
  seasonYear: number | null;
  wipeouts: AdminWipeout[];
  waitingGames: AdminGame[];
  hasCurrentWeek: boolean;
  toConfirm?: AdminRequestLine[];
  declined?: AdminRequestLine[];
}): AdminNextStep {
  if (input.seasonYear === null) return { kind: "no_schedule" };
  if (input.toConfirm?.length) return { kind: "confirm", request: input.toConfirm[0]! };
  if (input.declined?.length) return { kind: "declined", request: input.declined[0]! };
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

    // Requests for another admin's confirmation. The viewer's own pending ones are "waiting" and
    // their wipeout is not offered to them again; declined ones show until dismissed.
    const adminId = session.user.id;
    const asLine = (r: typeof adminRequests.$inferSelect & { pool: { name: string } }, asked: string[]): AdminRequestLine => ({
      id: r.id,
      kind: r.kind as AdminRequestLine["kind"],
      poolId: r.poolId,
      poolName: r.pool.name,
      requestedByName: r.requestedByName,
      wipeoutId: r.wipeoutId,
      declineReason: r.declineReason,
      decidedByName: r.decidedByName,
      askedAdmins: asked,
    });
    const pending = await db.query.adminRequests.findMany({
      where: eq(adminRequests.status, "pending"),
      orderBy: [asc(adminRequests.createdAt)],
      with: { pool: true },
    });
    const declinedRows = await db.query.adminRequests.findMany({
      where: and(eq(adminRequests.status, "declined"), eq(adminRequests.requestedBy, adminId), isNull(adminRequests.seenAt)),
      orderBy: [desc(adminRequests.createdAt)],
      with: { pool: true },
    });
    const askedNames = (await otherAdmins(db, adminId)).map((a) => a.name);
    const toConfirm = pending.filter((r) => r.requestedBy !== adminId).map((r) => asLine(r, []));
    const waiting = pending.filter((r) => r.requestedBy === adminId).map((r) => asLine(r, askedNames));
    const declined = declinedRows.map((r) => asLine(r, askedNames));
    const waitingWipeouts = new Set(waiting.map((r) => r.wipeoutId));
    const mineWipeouts = wipeouts.filter((w) => !waitingWipeouts.has(w.wipeoutId));

    const next = chooseNextStep({ seasonYear, wipeouts: mineWipeouts, waitingGames, hasCurrentWeek: week !== null, toConfirm, declined });

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
      wipeouts: mineWipeouts,
      requests: { toConfirm, declined, waiting },
      pools: poolLines,
      hasSurvivorPool: allPools.some((p) => p.type === "survivor" && p.seasonYear === seasonYear),
      next,
    };
    reply.send(body);
  });
}
