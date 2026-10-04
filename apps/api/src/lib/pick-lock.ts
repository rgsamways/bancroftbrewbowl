import { and, eq, min, sql } from "drizzle-orm";
import type { RevealPicks } from "@bbb/shared";
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

/** A pool's reveal rule; a pool saved before the rule existed behaves as "at_lock". */
export function revealRuleOf(pool: { rules: unknown }): RevealPicks {
  const rule = (pool.rules as { reveal_picks?: RevealPicks } | null)?.reveal_picks;
  return rule === "after_final_game" ? "after_final_game" : "at_lock";
}

/** Whether a week's picks may be shown to others: it has locked and, for "after_final_game",
 * every game of the week has a result. The one test every reader of other players' picks uses. */
export function isRevealed(week: { lockTime: Date; gamesPending: number }, rule: RevealPicks, now: Date): boolean {
  if (now < week.lockTime) return false;
  return rule === "after_final_game" ? week.gamesPending === 0 : true;
}

/** The week numbers whose picks other players may see: the locked weeks for "at_lock", and
 * the locked weeks with nothing still undecided for "after_final_game". */
export async function getRevealedWeeks(seasonYear: number, rule: RevealPicks, now: Date = new Date()): Promise<Set<number>> {
  const locked = await getLockedWeeks(seasonYear, now);
  if (rule !== "after_final_game") return locked;
  const rows = await db
    .select({
      weekNumber: games.weekNumber,
      pending: sql<number>`(count(*) filter (where ${games.result} = 'pending'))::int`,
    })
    .from(games)
    .where(eq(games.seasonYear, seasonYear))
    .groupBy(games.weekNumber);
  const undecided = new Set(rows.filter((r) => r.pending > 0).map((r) => r.weekNumber));
  return new Set([...locked].filter((w) => !undecided.has(w)));
}
