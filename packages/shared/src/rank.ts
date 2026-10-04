// Competition ranking for pick 'em: tied players share a rank and the next rank skips
// ("T4", then 8th). Reused by Standings.

export type Ranked = { rank: number; tied: boolean };

/** Rank of one score among all scores (the list includes that score). */
export function rankOf(points: number, allPoints: number[]): Ranked {
  const higher = allPoints.filter((p) => p > points).length;
  const same = allPoints.filter((p) => p === points).length;
  return { rank: higher + 1, tied: same > 1 };
}

/** Rank for every score, in the same order as the input. */
export function rankWithTies(scores: number[]): Ranked[] {
  return scores.map((s) => rankOf(s, scores));
}

/** "4th", "T4", "1st", "22nd" */
export function formatRank({ rank, tied }: Ranked, style: "short" | "ordinal" = "short"): string {
  if (style === "short") return tied ? `T${rank}` : String(rank);
  const mod100 = rank % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rank % 10] ?? "th";
  return `${tied ? "Tied for " : ""}${rank}${suffix}`;
}
