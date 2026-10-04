import { inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, picks } from "../db/schema.js";
import type { SeasonWeek } from "./entry-state.js";
import type { PickCounts } from "./pick-counts.js";

/** Weeks in which each pool has at least one pick. */
export async function pickedWeeksByPool(poolIds: string[]): Promise<Map<string, Set<number>>> {
  const result = new Map<string, Set<number>>();
  if (poolIds.length === 0) return result;
  const rows = await db
    .selectDistinct({ poolId: entries.poolId, week: picks.weekNumber })
    .from(picks)
    .innerJoin(entries, sql`${picks.entryId} = ${entries.id}`)
    .where(inArray(entries.poolId, poolIds));
  for (const r of rows) {
    const set = result.get(r.poolId) ?? new Set<number>();
    set.add(r.week);
    result.set(r.poolId, set);
  }
  return result;
}

/** The latest week that is fully decided and in which the pool had picks (a week the pool
 * skipped, such as one before it started, has nothing to recap). Null when there is none. */
export function latestRecapWeek(weeks: SeasonWeek[] | undefined, pickedWeeks: Set<number> | undefined): number | null {
  const decided = (weeks ?? []).filter((w) => w.gamesPending === 0 && pickedWeeks?.has(w.weekNumber));
  return decided.length > 0 ? Math.max(...decided.map((w) => w.weekNumber)) : null;
}

type WeekGame = { homeTeam: string; awayTeam: string; result: string; kickoffTime: Date };

/** The game whose winner the smallest share of players picked. Equal shares go to the game
 * whose loser was picked more (more players hurt), then to the earlier kickoff. Null when
 * nobody picked or no game has a winner. */
export function biggestUpset(weekGames: WeekGame[], counts: PickCounts | null): { winner: string; loser: string } | null {
  if (!counts || counts.pickers === 0) return null;
  const picked = new Map(counts.teams.map((t) => [t.team, t.picks]));
  const decided = weekGames
    .filter((g) => g.result === "home_win" || g.result === "away_win")
    .map((g) => {
      const home = g.result === "home_win";
      const winner = home ? g.homeTeam : g.awayTeam;
      const loser = home ? g.awayTeam : g.homeTeam;
      return { winner, loser, winnerPicks: picked.get(winner) ?? 0, loserPicks: picked.get(loser) ?? 0, kickoff: g.kickoffTime };
    });
  decided.sort(
    (a, b) =>
      a.winnerPicks - b.winnerPicks ||
      b.loserPicks - a.loserPicks ||
      a.kickoff.getTime() - b.kickoff.getTime()
  );
  const top = decided[0];
  return top ? { winner: top.winner, loser: top.loser } : null;
}
