// Shapes of GET /pools/:poolId/tv and GET /pools/:poolId/recap, and the small rules the pages share.
// No Node imports: bundled into the browser.

export type MostPicked = {
  team: string;
  picks: number;
  /** Whole percent of the players who picked that week. */
  sharePercent: number;
};

/** Whole percent, rounded; 0 when nobody picked. */
export function sharePercent(picks: number, pickers: number): number {
  return pickers > 0 ? Math.round((picks / pickers) * 100) : 0;
}

export type TvStatus = "open" | "locked" | "season_over" | "no_games";

export type TvLeaderRow = { name: string; points: number; rank: number; tied: boolean };

export type PoolTv = {
  pool: { id: string; name: string; type: "survivor" | "pick_em" };
  weekNumber: number | null;
  status: TvStatus;
  playersTotal: number;
  /** Survivor: how many are alive, and their names (A to Z). */
  playersLeft: number | null;
  alive: string[];
  /** Pick 'em: the top 10. */
  leaderboard: TvLeaderRow[];
  /** Survivor, after the lock only: the three most picked teams this week. Empty before the lock. */
  mostPicked: MostPicked[];
};

export type RecapPick = { team: string; result: "pending" | "win" | "loss" | "tie" };

export type PoolRecap = {
  pool: { id: string; name: string; type: "survivor" | "pick_em" };
  week: number;
  playersTotal: number;
  /** Survivor: alive at the end of that week, and how many went out in it. */
  playersLeft: number | null;
  playersOut: number | null;
  /** Survivor only: the most picked team that week, and the biggest upset. */
  mostPicked: MostPicked | null;
  upset: { winner: string; loser: string } | null;
  /** The viewer's own entry in this pool, if any. */
  you: {
    entryId: string;
    /** Survivor: still in at the end of that week. */
    survived: boolean | null;
    picks: RecapPick[];
    /** Pick 'em. */
    correct: number | null;
    gamesTotal: number | null;
    points: number | null;
    rank: number | null;
    tied: boolean;
  } | null;
  leaderPoints: number | null;
};

/** The text the Share button sends. Only the sender's own result: nobody else's picks. */
export function recapShareText(recap: PoolRecap, origin: string): string {
  const you = recap.you;
  let line: string;
  if (recap.pool.type === "survivor") {
    line =
      you?.survived === false
        ? `I'm out after week ${recap.week}.`
        : `Still alive after week ${recap.week}${recap.playersLeft !== null ? `: ${recap.playersLeft} of ${recap.playersTotal} left` : ""}.`;
  } else {
    line =
      you && you.correct !== null && you.gamesTotal !== null
        ? `I got ${you.correct} of ${you.gamesTotal} right in week ${recap.week}.`
        : `Week ${recap.week} recap.`;
  }
  return `${recap.pool.name}: ${line} Play at ${origin}`;
}
