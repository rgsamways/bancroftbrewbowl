import { sql } from "drizzle-orm";
import { SCOREBOARD_STALE_MS, scoreboardTtlMs, sortScoreboardGames, type ScoreboardGame } from "@bbb/shared";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { currentWeek, loadSeasonWeeks } from "./entry-state.js";
import { fetchEspnScoreboardWeek, type EspnGame } from "./espn.js";

// The scoreboard on Home, from ESPN, shared by everyone. ESPN is read at most once at a time, the
// answer is reused for a short while (shorter when a game is live), and if ESPN fails the last good
// answer is served for up to an hour. Nothing here decides a pick or a result: it is for looking at.
// Railway runs one API process, so a cache in memory is enough; this is the one place to change if
// that ever stops being true.

export type SharedScoreboard = {
  seasonYear: number;
  weekNumber: number;
  asOf: Date;
  stale: boolean;
  games: ScoreboardGame[];
  byes: string[];
};

type Reader = typeof fetchEspnScoreboardWeek;
type Cached = SharedScoreboard & { key: string; fetchedAt: number; ttl: number };

let cache: Cached | null = null;
let inflight: { key: string; promise: Promise<Cached> } | null = null;

/** For tests: forget everything. */
export function resetScoreboardCache() {
  cache = null;
  inflight = null;
}

const toGame = (g: EspnGame): ScoreboardGame => ({
  homeTeam: g.homeTeam,
  awayTeam: g.awayTeam,
  kickoff: g.kickoff.toISOString(),
  state: g.state,
  statusText: g.statusText,
  homeScore: g.homeScoreNow,
  awayScore: g.awayScoreNow,
  homeRecord: g.homeRecord,
  awayRecord: g.awayRecord,
  network: g.network,
});

/** The season and week Home is on: the latest season that has games, and its current week. */
async function currentSeasonWeek(): Promise<{ seasonYear: number; weekNumber: number } | null> {
  const [latest] = await db.select({ year: sql<number>`max(${games.seasonYear})::int` }).from(games);
  const seasonYear = latest?.year;
  if (!seasonYear) return null;
  const week = currentWeek((await loadSeasonWeeks([seasonYear])).get(seasonYear));
  return week ? { seasonYear, weekNumber: week.weekNumber } : null;
}

/** The scoreboard for the current week, or null when there is none to show (no games, the season
 * is over, or ESPN has been unreadable for over an hour). Never throws for an ESPN problem. */
export async function getScoreboard(now: Date = new Date(), read: Reader = fetchEspnScoreboardWeek): Promise<SharedScoreboard | null> {
  const at = await currentSeasonWeek();
  if (!at) return null;
  const key = `${at.seasonYear}:${at.weekNumber}`;
  const nowMs = now.getTime();

  if (cache && cache.key === key && nowMs - cache.fetchedAt < cache.ttl) return { ...cache, stale: false };

  // One read at a time: everyone who arrives meanwhile shares it.
  if (!inflight || inflight.key !== key) {
    const promise = (async (): Promise<Cached> => {
      const { games: espnGames, byes } = await read(at.seasonYear, at.weekNumber);
      const list = sortScoreboardGames(espnGames.map(toGame));
      return {
        key,
        seasonYear: at.seasonYear,
        weekNumber: at.weekNumber,
        asOf: new Date(nowMs),
        stale: false,
        games: list,
        byes: byes.map(String),
        fetchedAt: nowMs,
        // SCOREBOARD_TTL_MS shortens the cache for the browser tests only.
        ttl: process.env.SCOREBOARD_TTL_MS ? Number(process.env.SCOREBOARD_TTL_MS) : scoreboardTtlMs(list, nowMs),
      };
    })();
    inflight = { key, promise };
    promise.finally(() => {
      if (inflight?.promise === promise) inflight = null;
    }).catch(() => undefined);
  }

  try {
    const fresh = await inflight.promise;
    cache = fresh;
    return { ...fresh, stale: false };
  } catch {
    // ESPN trouble: serve the last good answer for a while, then nothing. Never an error for the player.
    if (cache && cache.key === key && nowMs - cache.fetchedAt < SCOREBOARD_STALE_MS) return { ...cache, stale: true };
    return null;
  }
}
