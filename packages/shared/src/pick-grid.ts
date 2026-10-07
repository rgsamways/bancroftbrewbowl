// The week-by-week grid on Standings (GET /pools/:poolId/pick-grid), and the pure function that
// builds it from picks that have ALREADY been filtered for what the viewer may see. The grid has no
// privacy rule of its own: whatever is not in the input never reaches the output.
// No Node imports: bundled into the browser.
import { rankOf } from "./rank.js";

export type GridResult = "pending" | "win" | "loss" | "tie";

export type GridCell =
  /** Survivor: the team(s) picked that week and how each is going. */
  | { kind: "picks"; picks: { team: string; result: GridResult }[] }
  /** A pick exists but the viewer may not see which (an admin's marker). */
  | { kind: "hidden" }
  /** Pick 'em: correct picks that week among the picks shown, out of the week's games. */
  | { kind: "points"; correct: number; of: number }
  | { kind: "empty" }
  /** A past week in which nobody in the pool picked (a late start): a bye for everyone. */
  | { kind: "free_pass" };

export type GridRow = {
  entryId: string;
  name: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  isYou: boolean;
  /** One cell per week in `weeks`, in the same order. */
  cells: GridCell[];
  /** Pick 'em only. */
  total?: number;
  rank?: number;
  tied?: boolean;
};

export type PickGrid = {
  pool: { id: string; name: string; type: "survivor" | "pick_em"; seasonYear: number };
  /** Every week from 1 to the current week (every season week once the season is over). */
  weeks: number[];
  /** The weeks, among `weeks`, that were a free pass for everyone. */
  freePassWeeks: number[];
  rows: GridRow[];
  /** Survivor: per week (same order as `weeks`), the most picked team among the picks shown. */
  mostPicked: ({ team: string; sharePercent: number } | null)[];
  /** Survivor, the viewer's own teams. Null for pick 'em or a viewer with no entry. */
  teamsUsed: { used: number; total: number; repeatsAllowed: boolean } | null;
};

/** A pick as the viewer is allowed to see it (the output of the shared privacy filter). */
export type VisiblePick = {
  entryId: string;
  weekNumber: number;
  /** Null when only the fact that a pick exists may be shown (an admin's marker). */
  teamCode: string | null;
  result: GridResult | null;
  submitted?: true;
};

export type GridEntry = {
  entryId: string;
  name: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  isYou: boolean;
};

export type BuildGridInput = {
  pool: PickGrid["pool"];
  weeks: number[];
  /** Past weeks in which nobody in the pool picked. */
  freePassWeeks: number[];
  gamesPerWeek: Record<number, number>;
  entries: GridEntry[];
  picks: VisiblePick[];
  /** Pick 'em: does a tied game count as correct? */
  tieCounts: boolean;
  /** Survivor: may a team be used again? */
  repeatsAllowed: boolean;
  /** The viewer's own picks in every week (they may always see these), for "teams used". */
  ownPicks: { weekNumber: number; teamCode: string }[];
  teamCount: number;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function buildPickGrid(input: BuildGridInput): PickGrid {
  const { pool, weeks, entries, picks } = input;
  const survivor = pool.type === "survivor";
  const shown = picks.filter((p) => weeks.includes(p.weekNumber));

  const cellFor = (entryId: string, week: number): GridCell => {
    if (input.freePassWeeks.includes(week)) return { kind: "free_pass" };
    const mine = shown.filter((p) => p.entryId === entryId && p.weekNumber === week);
    if (mine.length === 0) return { kind: "empty" };
    const visible = mine.filter((p) => p.teamCode !== null);
    if (survivor) {
      if (visible.length === 0) return { kind: "hidden" };
      return { kind: "picks", picks: visible.map((p) => ({ team: p.teamCode!, result: p.result ?? "pending" })) };
    }
    if (visible.length === 0) return { kind: "hidden" };
    const correct = visible.filter((p) => p.result === "win" || (p.result === "tie" && input.tieCounts)).length;
    return { kind: "points", correct, of: input.gamesPerWeek[week] ?? visible.length };
  };

  const rows: GridRow[] = entries.map((e) => ({
    entryId: e.entryId,
    name: e.name,
    status: e.status,
    eliminatedWeek: e.eliminatedWeek,
    isYou: e.isYou,
    cells: weeks.map((w) => cellFor(e.entryId, w)),
  }));

  if (survivor) {
    // Alive A to Z, then the eliminated with the longest-lasting first, so the grid narrows toward
    // the bottom. Nobody is pinned: the viewer's row is only highlighted.
    rows.sort(
      (a, b) =>
        Number(a.status === "eliminated") - Number(b.status === "eliminated") ||
        (b.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0) ||
        byName(a, b)
    );
  } else {
    const totals = rows.map((r) => r.cells.reduce((sum, c) => sum + (c.kind === "points" ? c.correct : 0), 0));
    rows.forEach((r, i) => {
      r.total = totals[i]!;
      const ranked = rankOf(totals[i]!, totals);
      r.rank = ranked.rank;
      r.tied = ranked.tied;
    });
    rows.sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || byName(a, b));
  }

  const mostPicked = weeks.map((w) => {
    if (!survivor) return null;
    const seen = shown.filter((p) => p.weekNumber === w && p.teamCode !== null);
    if (seen.length === 0) return null;
    const counts = new Map<string, number>();
    for (const p of seen) counts.set(p.teamCode!, (counts.get(p.teamCode!) ?? 0) + 1);
    const [team, n] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    const pickers = new Set(seen.map((p) => p.entryId)).size;
    return { team, sharePercent: Math.round((n / pickers) * 100) };
  });

  const hasOwnEntry = entries.some((e) => e.isYou);
  const teamsUsed =
    survivor && hasOwnEntry
      ? { used: new Set(input.ownPicks.map((p) => p.teamCode)).size, total: input.teamCount, repeatsAllowed: input.repeatsAllowed }
      : null;

  return { pool, weeks, freePassWeeks: weeks.filter((w) => input.freePassWeeks.includes(w)), rows, mostPicked, teamsUsed };
}

/** The note under the grid for free-pass weeks, or null when there are none.
 * "No picks were made in weeks 1 to 4 (the pool started late), so everyone got a free pass." */
export function describeFreePass(weeks: number[]): string | null {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const runs: [number, number][] = [];
  for (const w of sorted) {
    const last = runs[runs.length - 1];
    if (last && w === last[1] + 1) last[1] = w;
    else runs.push([w, w]);
  }
  const parts = runs.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a} and ${b}` : `${a} to ${b}`));
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const noun = sorted.length === 1 ? "week" : "weeks";
  const late = sorted[0] === 1 ? " (the pool started late)" : "";
  return `No picks were made in ${noun} ${list}${late}, so everyone got a free pass.`;
}
