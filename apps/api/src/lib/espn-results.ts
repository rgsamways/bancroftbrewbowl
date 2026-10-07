import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { fetchEspnWeek, type EspnGame } from "./espn.js";
import { scoreGame } from "./scoring.js";
import { ownEntryChanged, ownEntryStatuses, type Actor } from "./activity.js";

// "Check for results": ask ESPN which games have finished that are still undecided here, show them,
// and (only when an admin confirms) save and score them exactly as a hand-entered result is. Nothing
// here runs on a schedule, and a result that is already decided is never overwritten.

export type FinishedGame = {
  gameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  result: "home_win" | "away_win" | "tie";
  homeScore: number | null;
  awayScore: number | null;
};

export type DifferingGame = {
  gameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  enteredResult: "home_win" | "away_win" | "tie";
  espnResult: "home_win" | "away_win" | "tie";
};

/** A game that has not started whose kickoff on ESPN differs from ours (the NFL flexed or moved it). */
export type MovedGame = {
  gameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  from: string;
  to: string;
};

export type EspnPreview = {
  seasonYear: number | null;
  checkedAt: string;
  finished: FinishedGame[];
  differs: DifferingGame[];
  moved: MovedGame[];
};

/** How far apart two kickoff times must be to count as moved (ESPN rounds differently). */
const MOVED_AFTER_MS = 60_000;
/** Flexes are announced ahead, so look at the current week and the next two weeks too. */
const WEEKS_AHEAD = 3;

type GameRow = typeof games.$inferSelect;

/** The latest season that has games (the same "current season" rule as Next step and Results). */
async function latestSeason(): Promise<number | null> {
  const [row] = await db.select({ year: sql<number>`max(${games.seasonYear})::int` }).from(games);
  return row?.year ?? null;
}

/** Which weeks to ask ESPN about: `results` are weeks that have kicked off and still have an undecided
 * game; `moves` are the first few weeks with an undecided game (the current week and the next two),
 * where a game may have been moved. */
async function weeksToAsk(seasonYear: number, now: Date): Promise<{ results: number[]; moves: number[]; all: number[] }> {
  const rows = await db
    .select({
      week: games.weekNumber,
      firstKickoff: min(games.kickoffTime),
      pending: sql<number>`(count(*) filter (where ${games.result} = 'pending'))::int`,
    })
    .from(games)
    .where(eq(games.seasonYear, seasonYear))
    .groupBy(games.weekNumber)
    .orderBy(asc(games.weekNumber));
  const open = rows.filter((r) => r.pending > 0);
  const results = open.filter((r) => r.firstKickoff && new Date(r.firstKickoff) <= now).map((r) => r.week);
  const moves = open.slice(0, WEEKS_AHEAD).map((r) => r.week);
  return { results, moves, all: [...new Set([...results, ...moves])].sort((a, b) => a - b) };
}

/** Games that have not started and have no result whose ESPN kickoff differs from ours. */
function movedGames(ours: GameRow[], espn: Map<string, EspnGame>, now: Date): MovedGame[] {
  const out: MovedGame[] = [];
  for (const game of ours) {
    if (game.result !== "pending" || new Date(game.kickoffTime) <= now) continue; // started games are never moved
    const theirs = espn.get(keyOf(game.homeTeam, game.awayTeam));
    if (!theirs || Number.isNaN(theirs.kickoff.getTime())) continue;
    if (Math.abs(theirs.kickoff.getTime() - new Date(game.kickoffTime).getTime()) <= MOVED_AFTER_MS) continue;
    out.push({
      gameId: game.id,
      week: game.weekNumber,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      from: new Date(game.kickoffTime).toISOString(),
      to: theirs.kickoff.toISOString(),
    });
  }
  return out;
}

const keyOf = (home: string, away: string) => `${home}|${away}`;

function espnByKey(espnGames: EspnGame[]) {
  return new Map(espnGames.map((g) => [keyOf(g.homeTeam, g.awayTeam), g]));
}

/** Look only; nothing is written. Throws EspnError if ESPN cannot be read. */
export async function previewEspnResults(now: Date = new Date()): Promise<EspnPreview> {
  const seasonYear = await latestSeason();
  const preview: EspnPreview = { seasonYear, checkedAt: now.toISOString(), finished: [], differs: [], moved: [] };
  if (seasonYear === null) return preview;

  const weeks = await weeksToAsk(seasonYear, now);
  for (const week of weeks.all) {
    const espn = espnByKey(await fetchEspnWeek(seasonYear, week));
    const ours = await db.query.games.findMany({ where: and(eq(games.seasonYear, seasonYear), eq(games.weekNumber, week)) });
    if (weeks.moves.includes(week)) preview.moved.push(...movedGames(ours, espn, now));
    if (!weeks.results.includes(week)) continue;
    for (const game of ours) {
      const theirs = espn.get(keyOf(game.homeTeam, game.awayTeam));
      if (!theirs || !theirs.final || theirs.result === "pending") continue;
      if (game.result === "pending") {
        preview.finished.push({
          gameId: game.id,
          week,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          result: theirs.result,
          homeScore: theirs.homeScore,
          awayScore: theirs.awayScore,
        });
      } else if (game.result !== theirs.result) {
        preview.differs.push({
          gameId: game.id,
          week,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          enteredResult: game.result,
          espnResult: theirs.result,
        });
      }
    }
  }
  return preview;
}

export type SkippedGame = { gameId: string; reason: "not_found" | "already_decided" | "not_final_on_espn" };

export type ApplyOutcome = {
  applied: { gameId: string; week: number; homeTeam: string; awayTeam: string; result: FinishedGame["result"] }[];
  skipped: SkippedGame[];
  /** Kickoffs updated to ESPN's time, and the ones left alone (started, decided or no longer different). */
  moved: MovedGame[];
  movedSkipped: SkippedGame[];
  wipeout: boolean;
  /** At least one applied result changed the status of an entry the admin plays. */
  affectsOwnEntry: boolean;
};

/** Saves and scores the listed games that are still undecided here and still final on ESPN. The
 * result and scores come from a fresh read of ESPN, never from the caller. Throws EspnError if ESPN
 * cannot be read, before anything is changed. The caller writes the Activity record. */
export async function applyEspnResults(gameIds: string[], actor: Actor, movedIds: string[] = [], now: Date = new Date()): Promise<ApplyOutcome> {
  const unique = [...new Set(gameIds)];
  const uniqueMoved = [...new Set(movedIds)];
  const allIds = [...new Set([...unique, ...uniqueMoved])];
  const rows = allIds.length > 0 ? await db.select().from(games).where(inArray(games.id, allIds)) : [];
  const byId = new Map(rows.map((g) => [g.id, g] as [string, GameRow]));

  // Read ESPN for every week involved first, so a failure changes nothing.
  const espnByWeek = new Map<string, Map<string, EspnGame>>();
  for (const game of rows) {
    const id = `${game.seasonYear}:${game.weekNumber}`;
    if (!espnByWeek.has(id)) espnByWeek.set(id, espnByKey(await fetchEspnWeek(game.seasonYear, game.weekNumber)));
  }

  const outcome: ApplyOutcome = { applied: [], skipped: [], moved: [], movedSkipped: [], wipeout: false, affectsOwnEntry: false };
  const ownBefore = await ownEntryStatuses(db, actor.id);

  for (const gameId of unique) {
    const game = byId.get(gameId);
    if (!game) {
      outcome.skipped.push({ gameId, reason: "not_found" });
      continue;
    }
    if (game.result !== "pending") {
      outcome.skipped.push({ gameId, reason: "already_decided" });
      continue;
    }
    const theirs = espnByWeek.get(`${game.seasonYear}:${game.weekNumber}`)?.get(keyOf(game.homeTeam, game.awayTeam));
    if (!theirs || !theirs.final || theirs.result === "pending") {
      outcome.skipped.push({ gameId, reason: "not_final_on_espn" });
      continue;
    }

    // Only a still-undecided game is written, so two taps at once cannot overwrite each other.
    const [saved] = await db
      .update(games)
      .set({
        result: theirs.result,
        homeScore: theirs.homeScore,
        awayScore: theirs.awayScore,
        enteredBy: actor.id,
        enteredAt: new Date(),
      })
      .where(and(eq(games.id, gameId), eq(games.result, "pending")))
      .returning();
    if (!saved) {
      outcome.skipped.push({ gameId, reason: "already_decided" });
      continue;
    }

    const scoring = await scoreGame(gameId);
    if (scoring.some((s) => s.wipeout)) outcome.wipeout = true;
    outcome.applied.push({ gameId, week: game.weekNumber, homeTeam: game.homeTeam, awayTeam: game.awayTeam, result: theirs.result });
  }

  // Moved kickoffs: only a game that has not started and has no result, and only when ESPN still
  // says a different time. Never a started game.
  for (const gameId of uniqueMoved) {
    const game = byId.get(gameId);
    if (!game) {
      outcome.movedSkipped.push({ gameId, reason: "not_found" });
      continue;
    }
    const theirs = espnByWeek.get(`${game.seasonYear}:${game.weekNumber}`)?.get(keyOf(game.homeTeam, game.awayTeam));
    const from = new Date(game.kickoffTime);
    if (game.result !== "pending" || from <= now) {
      outcome.movedSkipped.push({ gameId, reason: "already_decided" });
      continue;
    }
    if (!theirs || Number.isNaN(theirs.kickoff.getTime()) || Math.abs(theirs.kickoff.getTime() - from.getTime()) <= MOVED_AFTER_MS) {
      outcome.movedSkipped.push({ gameId, reason: "not_final_on_espn" });
      continue;
    }
    const [saved] = await db
      .update(games)
      .set({ kickoffTime: theirs.kickoff })
      .where(and(eq(games.id, gameId), eq(games.result, "pending")))
      .returning();
    if (!saved) {
      outcome.movedSkipped.push({ gameId, reason: "already_decided" });
      continue;
    }
    outcome.moved.push({ gameId, week: game.weekNumber, homeTeam: game.homeTeam, awayTeam: game.awayTeam, from: from.toISOString(), to: theirs.kickoff.toISOString() });
  }

  if (outcome.applied.length > 0) outcome.affectsOwnEntry = ownEntryChanged(ownBefore, await ownEntryStatuses(db, actor.id));
  return outcome;
}
