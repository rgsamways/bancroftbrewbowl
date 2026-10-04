import { and, eq, min } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";

// One definition of "when does a week lock", shared by everything that decides
// who may change a pick and who may see it, so reads and writes can't disagree.
//
// A week locks at its first kickoff. (Pool settings also list a `per_game_kickoff`
// deadline rule, but no server code reads it, so this is the only rule in force.
// If it is ever implemented, change it here and both reads and writes follow.)
//
// Note: `routes/nfl.ts` still works out its own
// copy for display. It is not about permissions and is left alone.

/** The moment a week locks, or null if no games are scheduled for it. */
export async function getWeekLockTime(seasonYear: number, weekNumber: number): Promise<Date | null> {
  const [row] = await db
    .select({ lockTime: min(games.kickoffTime) })
    .from(games)
    .where(and(eq(games.seasonYear, seasonYear), eq(games.weekNumber, weekNumber)));
  return row?.lockTime ? new Date(row.lockTime) : null;
}

/** The week numbers of a season that have already locked. */
export async function getLockedWeeks(seasonYear: number, now: Date = new Date()): Promise<Set<number>> {
  const rows = await db
    .select({ weekNumber: games.weekNumber, lockTime: min(games.kickoffTime) })
    .from(games)
    .where(eq(games.seasonYear, seasonYear))
    .groupBy(games.weekNumber);
  return new Set(rows.filter((r) => r.lockTime && new Date(r.lockTime) <= now).map((r) => r.weekNumber));
}
