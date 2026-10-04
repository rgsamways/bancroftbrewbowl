import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { rankOf, type PickEmRulesConfig, type PoolStandings, type StandingsRow } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { loadSeasonWeeks } from "../lib/entry-state.js";
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
    const nameOf = (e: (typeof poolEntries)[number]) => e.user?.name ?? e.invitedName ?? "A player";

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
}
