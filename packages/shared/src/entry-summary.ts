// Shapes of the two screens' single requests: GET /me/summary (Home) and
// GET /entries/:entryId/pick-sheet (Pick). Times are UTC ISO strings.

export const ENTRY_STATES = ["needs_picks", "picked", "locked", "eliminated", "season_over", "no_games"] as const;
export type EntryState = (typeof ENTRY_STATES)[number];

export type SummaryEntry = {
  entryId: string;
  poolId: string;
  poolName: string;
  poolType: "survivor" | "pick_em";
  seasonYear: number;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  state: EntryState;
  weekNumber: number | null;
  lockTime: string | null;
  picksMade: number;
  picksNeeded: number;
  playersTotal: number;
  /** Survivor only. */
  playersLeft: number | null;
  /** Pick 'em only. */
  points: number | null;
  rank: number | null;
  tied: boolean;
  gamesTotal: number | null;
  correctThisWeek: number | null;
  /** Set when the season is over: the survivor champion or the pick 'em winner, if there is one. */
  champion: string | null;
};

export type JoinablePool = { id: string; name: string; type: "survivor" | "pick_em"; seasonYear: number };

import type { BreweryHome } from "./brewery.js";

export type MeSummary = {
  serverNow: string;
  entries: SummaryEntry[];
  /** Open pools the player is not in. */
  joinablePools: JoinablePool[];
  /** What is happening at the brewery, for the "At the brewery" section of Home. */
  brewery: BreweryHome;
};

export type SheetGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  result: "pending" | "home_win" | "away_win" | "tie";
};

export type SheetPick = { weekNumber: number; teamCode: string; result: "pending" | "win" | "loss" | "tie" };

export type PickSheet = {
  serverNow: string;
  entryId: string;
  poolId: string;
  poolName: string;
  poolType: "survivor" | "pick_em";
  seasonYear: number;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  state: EntryState;
  weekNumber: number | null;
  lockTime: string | null;
  /** How many teams this week takes (survivor: 1, or 2 in a double-pick week). */
  limit: number;
  allowRepeatTeams: boolean;
  games: SheetGame[];
  /** Every pick this entry has made, all weeks. */
  picks: SheetPick[];
  /** Team code -> week it was used, for weeks other than the current one. */
  usedTeams: Record<string, number>;
};
