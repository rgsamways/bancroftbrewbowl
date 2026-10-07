import { and, eq, min, or, sql } from "drizzle-orm";
import type { PickDeadlineRule, RevealPicks } from "@bbb/shared";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";

// One definition of "when does a week lock", shared by everything that decides
// who may change a pick and who may see it, so reads and writes can't disagree.
//
// A pool's `pick_deadline_rule` decides what locks when. With `first_kickoff_of_week` (the rule of
// every pool saved before the setting was used) a week locks at its first kickoff. With
// `per_game_kickoff` each pick locks at its own game's kickoff. Reads and writes both go through
// the helpers here so they cannot disagree.
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

/** A pool's deadline rule; a pool without the rule (or with an unknown value) locks by the week. */
export function pickDeadlineRuleOf(pool: { rules: unknown }): PickDeadlineRule {
  const rule = (pool.rules as { pick_deadline_rule?: string } | null)?.pick_deadline_rule;
  return rule === "per_game_kickoff" ? "per_game_kickoff" : "first_kickoff_of_week";
}

type GameLockInput = { kickoffTime: Date | string; result: string };

/** A game is locked once it has kicked off, or has a result (so a kickoff that is later moved
 * cannot reopen a game that has been played). */
export function isGameLocked(game: GameLockInput, now: Date): boolean {
  return game.result !== "pending" || now >= new Date(game.kickoffTime);
}

/** The game a team plays in a week, or null when it is on a bye or not scheduled. */
export async function getTeamGame(seasonYear: number, weekNumber: number, team: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.seasonYear, seasonYear),
        eq(games.weekNumber, weekNumber),
        or(eq(games.homeTeam, team), eq(games.awayTeam, team))
      )
    )
    .limit(1);
  return game ?? null;
}

/** Keys ("week|team") of every team whose game has started or has a result, for per-game pools. */
export async function getStartedTeamKeys(seasonYear: number, now: Date = new Date()): Promise<Set<string>> {
  const rows = await db.select().from(games).where(eq(games.seasonYear, seasonYear));
  const keys = new Set<string>();
  for (const g of rows) {
    if (!isGameLocked(g, now)) continue;
    keys.add(`${g.weekNumber}|${g.homeTeam}`);
    keys.add(`${g.weekNumber}|${g.awayTeam}`);
  }
  return keys;
}

/** The test for "may other players see this pick yet": the one place that combines the pool's
 * deadline rule and reveal rule. With the reveal rule "after the week's last game is final" it is
 * by week for both deadline rules; otherwise a per-game pool reveals each pick as its game starts
 * and a whole-week pool reveals the whole week at its first kickoff. */
export async function revealPredicate(
  pool: { seasonYear: number; rules: unknown },
  now: Date = new Date()
): Promise<(row: { weekNumber: number; teamCode: string }) => boolean> {
  if (revealRuleOf(pool) === "after_final_game" || pickDeadlineRuleOf(pool) === "first_kickoff_of_week") {
    const weeks = await getRevealedWeeks(pool.seasonYear, revealRuleOf(pool), now);
    return (row) => weeks.has(row.weekNumber);
  }
  const started = await getStartedTeamKeys(pool.seasonYear, now);
  return (row) => started.has(`${row.weekNumber}|${row.teamCode}`);
}
