import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import type { EntryState } from "@bbb/shared";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { isGameLocked } from "./pick-lock.js";

// One definition of "what week is it and what does this entry need to do", used by Home,
// the Pick screen and the Pick tab, so they cannot disagree.
//
// The current week of a season is its first week whose games are not all decided. A week
// locks at its first kickoff (see pick-lock.ts). Between weeks, once one is fully decided,
// the next undecided week simply becomes current with its own lock time.

export type SeasonWeek = {
  weekNumber: number;
  lockTime: Date;
  gamesTotal: number;
  gamesPending: number;
};

/** Every week of each given season, in order, with its lock time and how many games remain. */
export async function loadSeasonWeeks(seasonYears: number[]): Promise<Map<number, SeasonWeek[]>> {
  const result = new Map<number, SeasonWeek[]>();
  if (seasonYears.length === 0) return result;
  const rows = await db
    .select({
      seasonYear: games.seasonYear,
      weekNumber: games.weekNumber,
      lockTime: min(games.kickoffTime),
      gamesTotal: sql<number>`count(*)::int`,
      gamesPending: sql<number>`(count(*) filter (where ${games.result} = 'pending'))::int`,
    })
    .from(games)
    .where(inArray(games.seasonYear, seasonYears))
    .groupBy(games.seasonYear, games.weekNumber)
    .orderBy(asc(games.seasonYear), asc(games.weekNumber));
  for (const row of rows) {
    if (!row.lockTime) continue;
    const list = result.get(row.seasonYear) ?? [];
    list.push({
      weekNumber: row.weekNumber,
      lockTime: new Date(row.lockTime),
      gamesTotal: row.gamesTotal,
      gamesPending: row.gamesPending,
    });
    result.set(row.seasonYear, list);
  }
  return result;
}

/** The first week not completely decided, or null when every week is decided (or there are none). */
export function currentWeek(weeks: SeasonWeek[] | undefined): SeasonWeek | null {
  return (weeks ?? []).find((w) => w.gamesPending > 0) ?? null;
}

/** How many teams the week takes: survivor 1 (2 in a double-pick week), pick 'em one per game. */
export function picksNeededFor(poolType: "survivor" | "pick_em", doublePickWeeks: number[], week: SeasonWeek): number {
  if (poolType === "pick_em") return week.gamesTotal;
  return doublePickWeeks.includes(week.weekNumber) ? 2 : 1;
}

/** One game of the current week, enough to tell whether it has started. */
export type WeekGameLite = { homeTeam: string; awayTeam: string; kickoffTime: Date | string; result: string };

/** For a pool that locks each pick at its own game: the week's games and the teams this entry has
 * picked in it. Without this, the whole week locks at its first kickoff. */
export type PerGameInput = { poolType: "survivor" | "pick_em"; games: WeekGameLite[]; pickTeams: string[] };

export type EntryStateInput = {
  entryStatus: "alive" | "eliminated";
  poolStatus: "draft" | "active" | "completed";
  weeks: SeasonWeek[] | undefined;
  picksMadeThisWeek: (weekNumber: number) => number;
  picksNeeded: (week: SeasonWeek) => number;
  now: Date;
  /** Set for a per-game pool; gives the current week's games and this entry's picks in it. */
  perGame?: (week: SeasonWeek) => PerGameInput;
};

export type EntryStateResult = {
  state: EntryState;
  week: SeasonWeek | null;
  picksMade: number;
  picksNeeded: number;
  /** Per-game pools only: the next lock that matters to this entry (its own pick's kickoff when it
   * has one, else the next game still open); null when nothing can change. */
  lockTime?: Date | null;
};

export function deriveEntryState(input: EntryStateInput): EntryStateResult {
  const none = { week: null, picksMade: 0, picksNeeded: 0 };
  // "Out" wins over everything: a mulligan keeps an entry alive, so this is only ever true
  // for an entry that really has been eliminated, and nothing here reveals a saved life.
  if (input.entryStatus === "eliminated") return { state: "eliminated", ...none };
  if (!input.weeks || input.weeks.length === 0) return { state: "no_games", ...none };
  if (input.poolStatus === "completed") return { state: "season_over", ...none };

  const week = currentWeek(input.weeks);
  if (!week) return { state: "season_over", ...none };

  const needed = input.picksNeeded(week);
  const made = Math.min(input.picksMadeThisWeek(week.weekNumber), needed);

  if (input.perGame) {
    const { poolType, games: weekGames, pickTeams } = input.perGame(week);
    const result = (state: EntryState, lockTime: Date | null): EntryStateResult => ({ state, week, picksMade: made, picksNeeded: needed, lockTime });
    const open = weekGames.filter((g) => !isGameLocked(g, input.now));
    if (open.length === 0) return result("locked", null);
    const kickoff = (g: WeekGameLite) => new Date(g.kickoffTime);
    const earliest = (list: WeekGameLite[]) => new Date(Math.min(...list.map((g) => kickoff(g).getTime())));
    const nextOpen = earliest(open);
    const gameOf = (team: string) => weekGames.find((g) => g.homeTeam === team || g.awayTeam === team);

    if (poolType === "survivor") {
      if (made >= needed) {
        const ownOpen = pickTeams.map(gameOf).filter((g): g is WeekGameLite => g !== undefined && !isGameLocked(g, input.now));
        // Every pick's game has started: nothing left to do or change this week.
        return ownOpen.length === 0 ? result("locked", null) : result("picked", earliest(ownOpen));
      }
      return result("needs_picks", nextOpen);
    }
    // Pick 'em: every game that has not started needs a pick.
    const missing = open.filter((g) => !pickTeams.some((t) => t === g.homeTeam || t === g.awayTeam));
    return result(missing.length === 0 ? "picked" : "needs_picks", nextOpen);
  }

  if (input.now >= week.lockTime) return { state: "locked", week, picksMade: made, picksNeeded: needed };
  return { state: made >= needed ? "picked" : "needs_picks", week, picksMade: made, picksNeeded: needed };
}

/** The teams that play in a week (home or away). Used to refuse a pick for a team on a bye. */
export async function teamsPlayingInWeek(seasonYear: number, weekNumber: number): Promise<Set<string>> {
  const rows = await db
    .select({ home: games.homeTeam, away: games.awayTeam })
    .from(games)
    .where(and(eq(games.seasonYear, seasonYear), eq(games.weekNumber, weekNumber)));
  return new Set(rows.flatMap((r) => [r.home, r.away]));
}
