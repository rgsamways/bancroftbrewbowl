// Shape of GET /admin/summary: everything the admin "Next step" screen needs in one request,
// with the choice of next step made on the server so it can be tested. No Node imports.

export type AdminGame = { id: string; homeTeam: string; awayTeam: string; kickoffTime: string };

export type AdminWipeout = {
  wipeoutId: string;
  poolId: string;
  poolName: string;
  weekNumber: number;
  game: { homeTeam: string; awayTeam: string } | null;
  candidates: number;
};

export type AdminPoolLine = {
  id: string;
  name: string;
  type: "survivor" | "pick_em";
  status: "draft" | "active" | "completed";
  seasonYear: number;
  alive: number;
  total: number;
};

export type AdminNextStep =
  | { kind: "no_schedule" }
  | { kind: "wipeout"; wipeout: AdminWipeout }
  | { kind: "results"; waiting: AdminGame[] }
  | { kind: "season_complete" }
  | { kind: "caught_up" };

export type AdminSummary = {
  serverNow: string;
  scheduleLoaded: boolean;
  seasonYear: number | null;
  weekNumber: number | null;
  /** Games in the current week, and how many already have a result. */
  weekGamesTotal: number;
  weekGamesEntered: number;
  lockTime: string | null;
  locked: boolean;
  /** Games that have kicked off with no result, oldest first. */
  waitingGames: AdminGame[];
  wipeouts: AdminWipeout[];
  pools: AdminPoolLine[];
  /** True when a survivor pool exists in the current season (drives the correction warning). */
  hasSurvivorPool: boolean;
  next: AdminNextStep;
};
