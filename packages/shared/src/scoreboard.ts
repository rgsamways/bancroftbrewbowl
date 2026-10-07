// Shape of GET /me/scoreboard (the NFL scoreboard on Home). Times are UTC ISO strings.
// No Node imports: bundled into the browser. There are deliberately no odds or lines in here.

export type ScoreboardState = "upcoming" | "live" | "final";

export type ScoreboardGame = {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  state: ScoreboardState;
  /** "Q3 4:21", "Halftime", "Final", "Final/OT", "Postponed"; empty for a game that has not started. */
  statusText: string;
  /** Scores as they stand now; null before kickoff. */
  homeScore: number | null;
  awayScore: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  /** The TV network, for example "Prime Video". */
  network: string | null;
};

/** The teams the signed-in player picked this week, per pool. Their own picks only. */
export type ScoreboardPicks = { poolId: string; poolName: string; teams: string[] };

export type Scoreboard = {
  seasonYear: number;
  weekNumber: number;
  /** When ESPN was last read. */
  asOf: string;
  /** True when ESPN could not be read just now and this is the last good answer. */
  stale: boolean;
  games: ScoreboardGame[];
  /** Teams on a bye this week. */
  byes: string[];
  yourPicks: ScoreboardPicks[];
};

/** What the endpoint returns: the scoreboard, or null when there is none to show. */
export type ScoreboardResponse = { scoreboard: Scoreboard | null };

const ORDER: Record<ScoreboardState, number> = { live: 0, upcoming: 1, final: 2 };

/** Live games first, then upcoming by kickoff, then finished by kickoff. */
export function sortScoreboardGames<T extends Pick<ScoreboardGame, "state" | "kickoff">>(games: T[]): T[] {
  return [...games].sort((a, b) => ORDER[a.state] - ORDER[b.state] || Date.parse(a.kickoff) - Date.parse(b.kickoff));
}

/** How long a cached scoreboard may be reused, in milliseconds: short while a game is live or about
 * to start, long when nothing is on. */
export function scoreboardTtlMs(games: Pick<ScoreboardGame, "state" | "kickoff">[], now: number): number {
  if (games.some((g) => g.state === "live")) return 20_000;
  const soon = games.some((g) => g.state === "upcoming" && Date.parse(g.kickoff) - now < 30 * 60_000);
  return soon ? 60_000 : 10 * 60_000;
}

/** How long the last good answer may be served when ESPN cannot be read. */
export const SCOREBOARD_STALE_MS = 60 * 60_000;

/** How often the screen asks again: sooner while a game is live. */
export function scoreboardPollMs(games: Pick<ScoreboardGame, "state">[]): number {
  return games.some((g) => g.state === "live") ? 30_000 : 5 * 60_000;
}
