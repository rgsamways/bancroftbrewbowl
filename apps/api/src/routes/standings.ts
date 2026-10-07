import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import {
  buildPickGrid,
  NFL_TEAM_CODES,
  publicName,
  rankOf,
  type PickEmRulesConfig,
  type PickGrid,
  type PoolStandings,
  type StandingsRow,
  type SurvivorRulesConfig,
  type VisiblePick,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, picks, pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { currentWeek, loadSeasonWeeks } from "../lib/entry-state.js";
import { isAdminUser } from "../lib/operator.js";
import { revealPredicate } from "../lib/pick-lock.js";
import { visiblePicks } from "../lib/pick-visibility.js";
import { computePickEmPoints } from "./entries.js";

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** Standings for one pool in a single request: counts, ordering and ranks are all worked out
 * here, so the phone only draws them. Names, status, elimination weeks and points only: no
 * emails and no picks. */
export async function standingsRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/standings", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });

    // "After week W": the last week that, with every earlier week, has nothing left undecided.
    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear) ?? [];
    let lastDecidedWeek: number | null = null;
    for (const week of weeks) {
      if (week.gamesPending > 0) break;
      lastDecidedWeek = week.weekNumber;
    }
    const seasonOver = pool.status === "completed" || (weeks.length > 0 && weeks.every((w) => w.gamesPending === 0));

    const mine = poolEntries.find((e) => e.userId === session.user.id) ?? null;
    const nameOf = (e: (typeof poolEntries)[number]) => publicName(e.user?.name, e.invitedName);

    const result: PoolStandings = {
      pool: {
        id: pool.id,
        name: pool.name,
        type: pool.type,
        seasonYear: pool.seasonYear,
        status: pool.status,
        poolTotalCents: pool.poolTotalCents,
      },
      lastDecidedWeek,
      seasonOver,
      playersTotal: poolEntries.length,
      me: null,
      alive: [],
      eliminated: [],
      leaderboard: [],
      leaderPoints: null,
    };

    if (pool.type === "survivor") {
      const rowFor = (e: (typeof poolEntries)[number]): StandingsRow => ({
        entryId: e.id,
        name: nameOf(e),
        isYou: e.id === mine?.id,
        eliminatedWeek: e.eliminatedWeek,
      });
      // The viewer first, then everyone else A to Z.
      result.alive = poolEntries
        .filter((e) => e.status === "alive")
        .map(rowFor)
        .sort((a, b) => Number(b.isYou) - Number(a.isYou) || byName(a, b));
      // Most recently eliminated first, then A to Z.
      result.eliminated = poolEntries
        .filter((e) => e.status === "eliminated")
        .map(rowFor)
        .sort((a, b) => (b.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0) || byName(a, b));
      if (mine) result.me = { entryId: mine.id, status: mine.status };
    } else {
      const points = await computePickEmPoints(
        poolEntries.map((e) => e.id),
        (pool.rules as PickEmRulesConfig).tie_handling
      );
      const all = poolEntries.map((e) => points.get(e.id) ?? 0);
      const rows = poolEntries.map((e): StandingsRow => {
        const pts = points.get(e.id) ?? 0;
        const { rank, tied } = rankOf(pts, all);
        return { entryId: e.id, name: nameOf(e), isYou: e.id === mine?.id, points: pts, rank, tied };
      });
      result.leaderboard = rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || byName(a, b));
      result.leaderPoints = rows.length > 0 ? Math.max(...all) : null;
      const myRow = rows.find((r) => r.isYou);
      if (mine && myRow) {
        result.me = { entryId: mine.id, status: mine.status, points: myRow.points, rank: myRow.rank, tied: myRow.tied };
      }
    }

    reply.send(result);
  });

  // The week-by-week grid. It has no privacy rule of its own: every pick goes through the same
  // `visiblePicks` + `revealPredicate` as the Pick screen, and only then is the grid built.
  fastify.get("/pools/:poolId/pick-grid", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });
    const rows = await db
      .select({
        entryId: picks.entryId,
        weekNumber: picks.weekNumber,
        teamCode: picks.teamCode,
        result: picks.result,
        ownerUserId: entries.userId,
      })
      .from(picks)
      .innerJoin(entries, eq(picks.entryId, entries.id))
      .where(eq(entries.poolId, poolId));

    const viewer = { userId: session.user.id, isAdmin: isAdminUser(session.user) };
    const visible = visiblePicks(rows, viewer, await revealPredicate(pool)) as VisiblePick[];

    // Columns: the weeks that have picks in this pool (shown or not), up to the current week.
    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear) ?? [];
    const now = currentWeek(weeks)?.weekNumber ?? Infinity;
    const withPicks = new Set(rows.map((r) => r.weekNumber));
    const columns = weeks.filter((w) => withPicks.has(w.weekNumber) && w.weekNumber <= now).map((w) => w.weekNumber);

    const mine = poolEntries.find((e) => e.userId === session.user.id) ?? null;
    const grid: PickGrid = buildPickGrid({
      pool: { id: pool.id, name: pool.name, type: pool.type, seasonYear: pool.seasonYear },
      weeks: columns,
      gamesPerWeek: Object.fromEntries(weeks.map((w) => [w.weekNumber, w.gamesTotal])),
      entries: poolEntries.map((e) => ({
        entryId: e.id,
        name: publicName(e.user?.name, e.invitedName),
        status: e.status,
        eliminatedWeek: e.eliminatedWeek,
        isYou: e.id === mine?.id,
      })),
      picks: visible,
      tieCounts: pool.type === "pick_em" && (pool.rules as PickEmRulesConfig).tie_handling === "everyone_correct",
      repeatsAllowed: pool.type === "survivor" && Boolean((pool.rules as SurvivorRulesConfig).allow_repeat_teams),
      ownPicks: mine ? rows.filter((r) => r.entryId === mine.id).map((r) => ({ weekNumber: r.weekNumber, teamCode: r.teamCode })) : [],
      teamCount: NFL_TEAM_CODES.length,
    });
    reply.send(grid);
  });
}
