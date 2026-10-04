import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { rankOf, sharePercent, type PickEmRulesConfig, type PoolTv, type TvStatus } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { currentWeek, loadSeasonWeeks } from "../lib/entry-state.js";
import { pickCounts } from "../lib/pick-counts.js";
import { computePickEmPoints } from "./entries.js";

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** What the bar's TV shows, in one request: names, counts and points only. Most picked
 * appears only once the week has locked (see lib/pick-counts.ts). */
export async function tvRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/tv", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }
    const now = new Date();

    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });
    const nameOf = (e: (typeof poolEntries)[number]) => e.user?.name ?? e.invitedName ?? "A player";

    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear) ?? [];
    const week = currentWeek(weeks);
    const status: TvStatus = weeks.length === 0 ? "no_games" : !week ? "season_over" : now >= week.lockTime ? "locked" : "open";

    const body: PoolTv = {
      pool: { id: pool.id, name: pool.name, type: pool.type },
      weekNumber: week?.weekNumber ?? null,
      status,
      playersTotal: poolEntries.length,
      playersLeft: null,
      alive: [],
      leaderboard: [],
      mostPicked: [],
    };

    if (pool.type === "survivor") {
      const alive = poolEntries.filter((e) => e.status === "alive").map(nameOf).sort(byName);
      body.alive = alive;
      body.playersLeft = alive.length;
      if (week) {
        const counts = await pickCounts(poolId, week, now);
        body.mostPicked = (counts?.teams ?? []).slice(0, 3).map((t) => ({
          team: t.team,
          picks: t.picks,
          sharePercent: sharePercent(t.picks, counts!.pickers),
        }));
      }
    } else {
      const points = await computePickEmPoints(
        poolEntries.map((e) => e.id),
        (pool.rules as PickEmRulesConfig).tie_handling
      );
      const all = poolEntries.map((e) => points.get(e.id) ?? 0);
      body.leaderboard = poolEntries
        .map((e) => {
          const pts = points.get(e.id) ?? 0;
          return { name: nameOf(e), points: pts, ...rankOf(pts, all) };
        })
        .sort((a, b) => b.points - a.points || byName(a.name, b.name))
        .slice(0, 10);
    }

    reply.send(body);
  });
}
