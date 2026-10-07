import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks } from "../db/schema.js";
import type { PickDeadlineRule, RevealPicks } from "@bbb/shared";
import type { SeasonWeek } from "./entry-state.js";
import { isGameLocked, isRevealed } from "./pick-lock.js";

export type PickCounts = {
  /** Players (entries) who picked at least once that week (among the picks that may be shown). */
  pickers: number;
  /** Picks per team, most picked first (ties A to Z). */
  teams: Array<{ team: string; picks: number }>;
};

/** How many picks each team got in one pool and week. Other players' picks stay hidden until
 * the pool's reveal time (see pick-visibility.ts and isRevealed), so this answers null before
 * it: no route can leak a count early because the gate is here, not in the callers.
 *
 * In a per-game pool (that reveals picks as each game starts) only picks whose game has started
 * are counted, with shares taken among those, so a part-played week never shows what picks for
 * games that have not started look like. */
export async function pickCounts(
  poolId: string,
  week: Pick<SeasonWeek, "weekNumber" | "lockTime" | "gamesPending">,
  rule: RevealPicks,
  now: Date,
  options: { deadline?: PickDeadlineRule; seasonYear?: number } = {}
): Promise<PickCounts | null> {
  if (!isRevealed(week, rule, now)) return null;

  let onlyTeams: string[] | null = null;
  if (options.deadline === "per_game_kickoff" && rule === "at_lock" && options.seasonYear !== undefined) {
    const weekGames = await db
      .select()
      .from(games)
      .where(and(eq(games.seasonYear, options.seasonYear), eq(games.weekNumber, week.weekNumber)));
    onlyTeams = weekGames.filter((g) => isGameLocked(g, now)).flatMap((g) => [g.homeTeam, g.awayTeam]);
    if (onlyTeams.length === 0) return { pickers: 0, teams: [] };
  }

  const where = and(
    eq(entries.poolId, poolId),
    eq(picks.weekNumber, week.weekNumber),
    onlyTeams ? inArray(picks.teamCode, onlyTeams) : undefined
  );

  const rows = await db
    .select({ team: picks.teamCode, count: sql<number>`count(*)::int` })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .where(where)
    .groupBy(picks.teamCode);

  const [{ pickers } = { pickers: 0 }] = await db
    .select({ pickers: sql<number>`count(distinct ${picks.entryId})::int` })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .where(where);

  return {
    pickers,
    teams: rows
      .map((r) => ({ team: r.team, picks: r.count }))
      .sort((a, b) => b.picks - a.picks || a.team.localeCompare(b.team)),
  };
}
