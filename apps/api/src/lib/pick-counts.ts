import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, picks } from "../db/schema.js";
import type { SeasonWeek } from "./entry-state.js";

export type PickCounts = {
  /** Players (entries) who picked at least once that week. */
  pickers: number;
  /** Picks per team, most picked first (ties A to Z). */
  teams: Array<{ team: string; picks: number }>;
};

/** How many picks each team got in one pool and week. Other players' picks stay hidden until
 * the week locks (see pick-visibility.ts), so this answers null before the lock: no route can
 * leak a count early because the gate is here, not in the callers. */
export async function pickCounts(
  poolId: string,
  week: Pick<SeasonWeek, "weekNumber" | "lockTime">,
  now: Date
): Promise<PickCounts | null> {
  if (now < week.lockTime) return null;

  const rows = await db
    .select({ team: picks.teamCode, count: sql<number>`count(*)::int` })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .where(and(eq(entries.poolId, poolId), eq(picks.weekNumber, week.weekNumber)))
    .groupBy(picks.teamCode);

  const [{ pickers } = { pickers: 0 }] = await db
    .select({ pickers: sql<number>`count(distinct ${picks.entryId})::int` })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .where(and(eq(entries.poolId, poolId), eq(picks.weekNumber, week.weekNumber)));

  return {
    pickers,
    teams: rows
      .map((r) => ({ team: r.team, picks: r.count }))
      .sort((a, b) => b.picks - a.picks || a.team.localeCompare(b.team)),
  };
}
