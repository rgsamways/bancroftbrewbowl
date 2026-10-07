import { NFL_TEAM_CODES, type TeamCode } from "@bbb/shared";

// The one reader of ESPN's public scoreboard (unofficial, so everything it returns is checked and
// anything unexpected is reported rather than guessed). Used by the schedule script, the schedule
// loader, "Check for results" and the Home scoreboard. The base address can be changed with
// ESPN_BASE_URL so tests can point it at a stub.
//
// ESPN's payload also carries betting odds and logos. We never read them.

type EspnStatus = {
  displayClock?: string;
  period?: number;
  type?: { name?: string; state?: string; completed?: boolean; shortDetail?: string; detail?: string };
};

export type EspnEvent = {
  name: string;
  date: string;
  status?: EspnStatus;
  competitions: Array<{
    status: { type: { completed: boolean } } & EspnStatus;
    broadcasts?: Array<{ names?: string[] }>;
    competitors: Array<{
      team: { abbreviation: string };
      homeAway: "home" | "away";
      score?: string;
      winner?: boolean;
      records?: Array<{ type?: string; name?: string; summary?: string }>;
    }>;
  }>;
};

/** Where a game stands, in our words. */
export type EspnGameState = "upcoming" | "live" | "final";

export type EspnGame = {
  week: number;
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  kickoff: Date;
  /** The game is over on ESPN's side. */
  final: boolean;
  /** "pending" until final. */
  result: "pending" | "home_win" | "away_win" | "tie";
  /** Final scores only (null until the game is over). */
  homeScore: number | null;
  awayScore: number | null;
  /** For the scoreboard: how the game stands right now. */
  state: EspnGameState;
  /** "Q3 4:21", "Halftime", "Final/OT", "Postponed"; empty for a game that has not started. */
  statusText: string;
  /** Scores as they stand now (null before kickoff). */
  homeScoreNow: number | null;
  awayScoreNow: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
  network: string | null;
};

/** Thrown when ESPN cannot be reached or answers with something unusable. */
export class EspnError extends Error {}

const TIMEOUT_MS = 8000;

export function toTeamCode(espnAbbreviation: string): TeamCode | null {
  const code = espnAbbreviation === "WSH" ? "WAS" : espnAbbreviation;
  return (NFL_TEAM_CODES as readonly string[]).includes(code) ? (code as TeamCode) : null;
}

const asNumber = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The game's state and the short words for it. Delays, postponements and cancellations get plain words. */
function stateOf(status: EspnStatus | undefined, completed: boolean): { state: EspnGameState; text: string } {
  const type = status?.type;
  const name = (type?.name ?? "").toUpperCase();
  const detail = (type?.shortDetail ?? type?.detail ?? "").trim();
  if (name.includes("POSTPONED")) return { state: "upcoming", text: "Postponed" };
  if (name.includes("CANCEL")) return { state: "upcoming", text: "Canceled" };
  if (name.includes("DELAY") || name.includes("SUSPEND")) return { state: "live", text: detail || "Delayed" };
  if (completed || type?.state === "post") return { state: "final", text: detail || "Final" };
  if (type?.state === "in") return { state: "live", text: detail || "Live" };
  return { state: "upcoming", text: "" };
}

const recordOf = (c: EspnEvent["competitions"][number]["competitors"][number]): string | null =>
  c.records?.find((r) => r.type === "total" || r.name === "overall")?.summary ?? null;

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
    const { state, text } = stateOf(event.status ?? competition.status, final);
    const started = state === "live" || state === "final";
    games.push({
      week,
      homeTeam,
      awayTeam,
      kickoff: new Date(event.date),
      final,
      result: !final ? "pending" : home.winner ? "home_win" : away.winner ? "away_win" : "tie",
      homeScore: final ? asNumber(home.score) : null,
      awayScore: final ? asNumber(away.score) : null,
      state,
      statusText: text,
      homeScoreNow: started ? asNumber(home.score) : null,
      awayScoreNow: started ? asNumber(away.score) : null,
      homeRecord: recordOf(home),
      awayRecord: recordOf(away),
      network: competition.broadcasts?.flatMap((b) => b.names ?? []).find(Boolean) ?? null,
    });
  }
  return { games, skipped };
}

export type EspnWeekPayload = { events: EspnEvent[]; byes: TeamCode[] };

/** One regular-season week as ESPN sends it: its events, and the teams on a bye. */
export async function fetchEspnWeekPayload(seasonYear: number, week: number): Promise<EspnWeekPayload> {
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
  const payload = data as { events?: unknown; week?: { teamsOnBye?: Array<{ abbreviation?: string }> } };
  if (!Array.isArray(payload.events)) throw new EspnError("ESPN's answer was not in the expected shape.");
  const byes = (payload.week?.teamsOnBye ?? [])
    .map((t) => (t.abbreviation ? toTeamCode(t.abbreviation) : null))
    .filter((t): t is TeamCode => t !== null);
  return { events: payload.events as EspnEvent[], byes };
}

/** The raw events ESPN lists for one regular-season week. */
export async function fetchEspnEvents(seasonYear: number, week: number): Promise<EspnEvent[]> {
  return (await fetchEspnWeekPayload(seasonYear, week)).events;
}

/** One week as our games. */
export async function fetchEspnWeek(seasonYear: number, week: number): Promise<EspnGame[]> {
  return parseEspnEvents(await fetchEspnEvents(seasonYear, week), week).games;
}

/** One week as our games, plus the teams on a bye (for the Home scoreboard). */
export async function fetchEspnScoreboardWeek(seasonYear: number, week: number): Promise<{ games: EspnGame[]; byes: TeamCode[] }> {
  const { events, byes } = await fetchEspnWeekPayload(seasonYear, week);
  return { games: parseEspnEvents(events, week).games, byes };
}
