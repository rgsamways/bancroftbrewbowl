import { asc, eq } from "drizzle-orm";
import { publicName, rankOf, sharePercent, type PickEmRulesConfig, type PoolTv, type TvStatus } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, type pools } from "../db/schema.js";
import { currentWeek, loadSeasonWeeks } from "./entry-state.js";
import { pickCounts } from "./pick-counts.js";
import { pickDeadlineRuleOf, revealRuleOf } from "./pick-lock.js";
import { computePickEmPoints } from "../routes/entries.js";

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** What a pool's TV shows: names, counts and points only (never emails or picks). Most picked
 * appears only once the week has locked (see lib/pick-counts.ts). Shared by the signed-in TV page
 * and the private TV screens. */
export async function buildPoolTv(pool: typeof pools.$inferSelect, now = new Date()): Promise<PoolTv> {
  const poolId = pool.id;
  const poolEntries = await db.query.entries.findMany({
    where: eq(entries.poolId, poolId),
    orderBy: [asc(entries.createdAt)],
    with: { user: true },
  });
  const nameOf = (e: (typeof poolEntries)[number]) => publicName(e.user?.name, e.invitedName);

  const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear) ?? [];
  const week = currentWeek(weeks);
  const status: TvStatus = weeks.length === 0 ? "no_games" : !week ? "season_over" : now >= week.lockTime ? "locked" : "open";

  const body: PoolTv = {
    pool: { id: pool.id, name: pool.name, type: pool.type },
    weekNumber: week?.weekNumber ?? null,
    status,
    revealPicks: revealRuleOf(pool),
    pickDeadline: pickDeadlineRuleOf(pool),
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
      const counts = await pickCounts(poolId, week, revealRuleOf(pool), now, { deadline: pickDeadlineRuleOf(pool), seasonYear: pool.seasonYear });
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

  return body;
}
