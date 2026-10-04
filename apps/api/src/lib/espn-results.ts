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

export type EspnPreview = {
  seasonYear: number | null;
  checkedAt: string;
  finished: FinishedGame[];
  differs: DifferingGame[];
};

type GameRow = typeof games.$inferSelect;

/** The latest season that has games (the same "current season" rule as Next step and Results). */
async function latestSeason(): Promise<number | null> {
  const [row] = await db.select({ year: sql<number>`max(${games.seasonYear})::int` }).from(games);
  return row?.year ?? null;
}

/** Weeks of the season that have kicked off and still have an undecided game. */
async function weeksToAsk(seasonYear: number, now: Date): Promise<number[]> {
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
  return rows.filter((r) => r.pending > 0 && r.firstKickoff && new Date(r.firstKickoff) <= now).map((r) => r.week);
}

const keyOf = (home: string, away: string) => `${home}|${away}`;

function espnByKey(espnGames: EspnGame[]) {
  return new Map(espnGames.map((g) => [keyOf(g.homeTeam, g.awayTeam), g]));
}

/** Look only; nothing is written. Throws EspnError if ESPN cannot be read. */
export async function previewEspnResults(now: Date = new Date()): Promise<EspnPreview> {
  const seasonYear = await latestSeason();
  const preview: EspnPreview = { seasonYear, checkedAt: now.toISOString(), finished: [], differs: [] };
  if (seasonYear === null) return preview;

  for (const week of await weeksToAsk(seasonYear, now)) {
    const espn = espnByKey(await fetchEspnWeek(seasonYear, week));
    const ours = await db.query.games.findMany({ where: and(eq(games.seasonYear, seasonYear), eq(games.weekNumber, week)) });
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
  wipeout: boolean;
  /** At least one applied result changed the status of an entry the admin plays. */
  affectsOwnEntry: boolean;
};

/** Saves and scores the listed games that are still undecided here and still final on ESPN. The
 * result and scores come from a fresh read of ESPN, never from the caller. Throws EspnError if ESPN
 * cannot be read, before anything is changed. The caller writes the Activity record. */
export async function applyEspnResults(gameIds: string[], actor: Actor): Promise<ApplyOutcome> {
  const unique = [...new Set(gameIds)];
  const rows = unique.length > 0 ? await db.select().from(games).where(inArray(games.id, unique)) : [];
  const byId = new Map(rows.map((g) => [g.id, g] as [string, GameRow]));

  // Read ESPN for every week involved first, so a failure changes nothing.
  const espnByWeek = new Map<string, Map<string, EspnGame>>();
  for (const game of rows) {
    const id = `${game.seasonYear}:${game.weekNumber}`;
    if (!espnByWeek.has(id)) espnByWeek.set(id, espnByKey(await fetchEspnWeek(game.seasonYear, game.weekNumber)));
  }

  const outcome: ApplyOutcome = { applied: [], skipped: [], wipeout: false, affectsOwnEntry: false };
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

  if (outcome.applied.length > 0) outcome.affectsOwnEntry = ownEntryChanged(ownBefore, await ownEntryStatuses(db, actor.id));
  return outcome;
}
