// Shape of GET /pools/:poolId/standings, and the avatar initials rule shared with the header.
// No Node imports: bundled into the browser.

/** Up to two letters for an avatar: "Robin Samways" gives RS, "robin@example.com" gives R. */
export function initials(name?: string | null, email?: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (email ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export type StandingsRow = {
  entryId: string;
  name: string;
  isYou: boolean;
  /** Survivor. */
  eliminatedWeek?: number | null;
  /** Pick 'em. */
  points?: number;
  rank?: number;
  tied?: boolean;
};

export type StandingsMe = {
  entryId: string;
  status: "alive" | "eliminated";
  points?: number;
  rank?: number;
  tied?: boolean;
};

export type PoolStandings = {
  pool: {
    id: string;
    name: string;
    type: "survivor" | "pick_em";
    seasonYear: number;
    status: "draft" | "active" | "completed";
    poolTotalCents: number | null;
  };
  /** Highest week that, with every earlier week, has no undecided games; null before any week is decided. */
  lastDecidedWeek: number | null;
  seasonOver: boolean;
  playersTotal: number;
  me: StandingsMe | null;
  /** Survivor lists (empty for pick 'em). */
  alive: StandingsRow[];
  eliminated: StandingsRow[];
  /** Pick 'em leaderboard (empty for survivor). */
  leaderboard: StandingsRow[];
  leaderPoints: number | null;
};
