import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { rankOf, sharePercent, type PickEmRulesConfig, type PoolRecap, type RecapPick } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { loadSeasonWeeks } from "../lib/entry-state.js";
import { pickCounts } from "../lib/pick-counts.js";
import { pickDeadlineRuleOf, revealRuleOf } from "../lib/pick-lock.js";
import { biggestUpset, latestRecapWeek, pickedWeeksByPool } from "../lib/recap.js";
import { computePickEmPoints } from "./entries.js";

/** The weekly recap for one pool, in one request. Only a fully decided week has a recap.
 * Counts and the caller's own picks only: no emails, nobody else's picks. */
export async function recapRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/recap", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const { week: weekParam } = request.query as { week?: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear) ?? [];
    const requested = weekParam === undefined ? null : Number(weekParam);
    if (requested !== null && !Number.isInteger(requested)) {
      reply.status(400).send({ error: "Invalid week" });
      return;
    }
    const weekNumber =
      requested ?? latestRecapWeek(weeks, (await pickedWeeksByPool([poolId])).get(poolId));
    const week = weeks.find((w) => w.weekNumber === weekNumber);
    if (!week || week.gamesPending > 0) {
      reply.status(404).send({ error: "No recap for that week" });
      return;
    }

    const poolEntries = await db.query.entries.findMany({ where: eq(entries.poolId, poolId) });
    const mine = poolEntries.find((e) => e.userId === session.user.id) ?? null;
    const myPicks: RecapPick[] = mine
      ? (await db.query.picks.findMany({ where: and(eq(picks.entryId, mine.id), eq(picks.weekNumber, week.weekNumber)) })).map(
          (p) => ({ team: p.teamCode, result: p.result })
        )
      : [];

    const body: PoolRecap = {
      pool: { id: pool.id, name: pool.name, type: pool.type },
      week: week.weekNumber,
      playersTotal: poolEntries.length,
      playersLeft: null,
      playersOut: null,
      mostPicked: null,
      upset: null,
      you: null,
      leaderPoints: null,
    };

    if (pool.type === "survivor") {
      // Still in at the end of that week: alive now, or eliminated after it.
      const inAfter = (e: (typeof poolEntries)[number]) =>
        e.status === "alive" || (e.eliminatedWeek ?? 0) > week.weekNumber;
      body.playersLeft = poolEntries.filter(inAfter).length;
      body.playersOut = poolEntries.filter((e) => e.status === "eliminated" && e.eliminatedWeek === week.weekNumber).length;

      const counts = await pickCounts(poolId, week, revealRuleOf(pool), new Date(), { deadline: pickDeadlineRuleOf(pool), seasonYear: pool.seasonYear });
      const top = counts?.teams[0];
      if (counts && top) {
        body.mostPicked = { team: top.team, picks: top.picks, sharePercent: sharePercent(top.picks, counts.pickers) };
      }
      const weekGames = await db.query.games.findMany({
        where: and(eq(games.seasonYear, pool.seasonYear), eq(games.weekNumber, week.weekNumber)),
      });
      body.upset = biggestUpset(weekGames, counts);

      if (mine) {
        body.you = {
          entryId: mine.id,
          survived: inAfter(mine),
          picks: myPicks,
          correct: null,
          gamesTotal: null,
          points: null,
          rank: null,
          tied: false,
        };
      }
    } else {
      const points = await computePickEmPoints(
        poolEntries.map((e) => e.id),
        (pool.rules as PickEmRulesConfig).tie_handling
      );
      const all = poolEntries.map((e) => points.get(e.id) ?? 0);
      body.leaderPoints = all.length > 0 ? Math.max(...all) : null;
      if (mine) {
        const countsTie = (pool.rules as PickEmRulesConfig).tie_handling === "everyone_correct";
        const ranked = rankOf(points.get(mine.id) ?? 0, all);
        body.you = {
          entryId: mine.id,
          survived: null,
          picks: myPicks,
          correct: myPicks.filter((p) => p.result === "win" || (p.result === "tie" && countsTie)).length,
          gamesTotal: week.gamesTotal,
          points: points.get(mine.id) ?? 0,
          rank: ranked.rank,
          tied: ranked.tied,
        };
      }
    }

    reply.send(body);
  });
}
