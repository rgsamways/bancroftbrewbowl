import { NFL_TEAM_CODES, type TeamCode } from "@bbb/shared";

// The one reader of ESPN's public scoreboard (unofficial, so everything it returns is checked and
// anything unexpected is reported rather than guessed). Used by the schedule script and by the
// admin "Check for results" button. The base address can be changed with ESPN_BASE_URL so tests
// can point it at a stub.

export type EspnEvent = {
  name: string;
  date: string;
  competitions: Array<{
    status: { type: { completed: boolean } };
    competitors: Array<{
      team: { abbreviation: string };
      homeAway: "home" | "away";
      score?: string;
      winner?: boolean;
    }>;
  }>;
};

export type EspnGame = {
  week: number;
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  kickoff: Date;
  /** The game is over on ESPN's side. */
  final: boolean;
  /** "pending" until final. */
  result: "pending" | "home_win" | "away_win" | "tie";
  homeScore: number | null;
  awayScore: number | null;
};

/** Thrown when ESPN cannot be reached or answers with something unusable. */
export class EspnError extends Error {}

const TIMEOUT_MS = 8000;

export function toTeamCode(espnAbbreviation: string): TeamCode | null {
  const code = espnAbbreviation === "WSH" ? "WAS" : espnAbbreviation;
  return (NFL_TEAM_CODES as readonly string[]).includes(code) ? (code as TeamCode) : null;
}

/** Turns ESPN's events for one week into our games. Events with a team we don't know are skipped
 * and listed in `skipped` so a caller can say so. */
export function parseEspnEvents(events: EspnEvent[], week: number): { games: EspnGame[]; skipped: string[] } {
  const games: EspnGame[] = [];
  const skipped: string[] = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors.find((c) => c.homeAway === "home");
    const away = competition?.competitors.find((c) => c.homeAway === "away");
    const homeTeam = home && toTeamCode(home.team.abbreviation);
    const awayTeam = away && toTeamCode(away.team.abbreviation);
    if (!competition || !home || !away || !homeTeam || !awayTeam) {
      skipped.push(event.name);
      continue;
    }
    const final = Boolean(competition.status?.type?.completed);
    games.push({
      week,
      homeTeam,
      awayTeam,
      kickoff: new Date(event.date),
      final,
      result: !final ? "pending" : home.winner ? "home_win" : away.winner ? "away_win" : "tie",
      homeScore: final && home.score !== undefined ? Number(home.score) : null,
      awayScore: final && away.score !== undefined ? Number(away.score) : null,
    });
  }
  return { games, skipped };
}

/** The raw events ESPN lists for one regular-season week. */
export async function fetchEspnEvents(seasonYear: number, week: number): Promise<EspnEvent[]> {
  const base = process.env.ESPN_BASE_URL ?? "https://site.api.espn.com";
  const url = `${base}/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${seasonYear}`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new EspnError("ESPN did not answer in time.");
  }
  if (!response.ok) throw new EspnError(`ESPN answered with an error (${response.status}).`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new EspnError("ESPN's answer could not be read.");
  }
  const events = (data as { events?: unknown }).events;
  if (!Array.isArray(events)) throw new EspnError("ESPN's answer was not in the expected shape.");
  return events as EspnEvent[];
}

/** One week as our games. */
export async function fetchEspnWeek(seasonYear: number, week: number): Promise<EspnGame[]> {
  return parseEspnEvents(await fetchEspnEvents(seasonYear, week), week).games;
}
