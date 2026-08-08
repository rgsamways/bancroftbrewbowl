export const POOL_STATUSES = ["draft", "active", "completed"] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];

export const ENTRY_STATUSES = ["alive", "eliminated"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const PICK_RESULTS = ["pending", "win", "loss", "tie"] as const;
export type PickResult = (typeof PICK_RESULTS)[number];

export const GAME_RESULTS = ["pending", "home_win", "away_win", "tie"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

export const TIE_HANDLING = ["elimination", "survive_burn_team"] as const;
export type TieHandling = (typeof TIE_HANDLING)[number];

export const TIEBREAKERS = ["playoff_performance"] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];

export const PICK_DEADLINE_RULES = ["first_kickoff_of_week", "per_game_kickoff"] as const;
export type PickDeadlineRule = (typeof PICK_DEADLINE_RULES)[number];
