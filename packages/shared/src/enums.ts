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

export const PROMOTION_KINDS = [
  "survivor_sunday",
  "elimination_consolation",
  "milestone_reward",
  "hot_team_special",
] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const POOL_TYPES = ["survivor", "pick_em"] as const;
export type PoolType = (typeof POOL_TYPES)[number];

// A tied/pushed game either counts for nobody or everybody who picked
// either team — distinct from survivor's elimination-flavored TIE_HANDLING.
export const PICK_EM_TIE_HANDLING = ["void", "everyone_correct"] as const;
export type PickEmTieHandling = (typeof PICK_EM_TIE_HANDLING)[number];
