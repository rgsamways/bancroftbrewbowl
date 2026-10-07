import { describe, expect, it } from "vitest";
import { buildPickGrid, type BuildGridInput, type GridEntry, type VisiblePick } from "./pick-grid.js";

const survivorPool = { id: "p", name: "Sunday Survivor", type: "survivor" as const, seasonYear: 2026 };
const pickEmPool = { id: "q", name: "Pick 'Em", type: "pick_em" as const, seasonYear: 2026 };

const entry = (id: string, name: string, over: Partial<GridEntry> = {}): GridEntry => ({
  entryId: id,
  name,
  status: "alive",
  eliminatedWeek: null,
  isYou: false,
  ...over,
});
const pick = (entryId: string, weekNumber: number, teamCode: string | null, result: VisiblePick["result"] = "pending"): VisiblePick => ({
  entryId,
  weekNumber,
  teamCode,
  result,
  ...(teamCode === null ? { submitted: true as const } : {}),
});

const base = (over: Partial<BuildGridInput>): BuildGridInput => ({
  pool: survivorPool,
  weeks: [5, 6],
  gamesPerWeek: { 5: 15, 6: 14 },
  entries: [],
  picks: [],
  tieCounts: false,
  repeatsAllowed: false,
  ownPicks: [],
  teamCount: 32,
  ...over,
});

describe("buildPickGrid: survivor", () => {
  it("makes a cell per week with the team and how it is going, and leaves other weeks empty", () => {
    const grid = buildPickGrid(
      base({
        entries: [entry("a", "Ann"), entry("b", "Bob")],
        picks: [pick("a", 5, "KC", "win"), pick("a", 6, "DET", "pending"), pick("b", 5, "BUF", "loss")],
      })
    );
    const ann = grid.rows.find((r) => r.entryId === "a")!;
    expect(ann.cells).toEqual([
      { kind: "picks", picks: [{ team: "KC", result: "win" }] },
      { kind: "picks", picks: [{ team: "DET", result: "pending" }] },
    ]);
    const bob = grid.rows.find((r) => r.entryId === "b")!;
    expect(bob.cells).toEqual([{ kind: "picks", picks: [{ team: "BUF", result: "loss" }] }, { kind: "empty" }]);
  });

  it("shows both teams of a double-pick week in one cell", () => {
    const grid = buildPickGrid(base({ entries: [entry("a", "Ann")], picks: [pick("a", 5, "KC", "win"), pick("a", 5, "PHI", "win")] }));
    expect(grid.rows[0]!.cells[0]).toEqual({
      kind: "picks",
      picks: [
        { team: "KC", result: "win" },
        { team: "PHI", result: "win" },
      ],
    });
  });

  it("an admin's marker is a hidden cell, and a week with nothing shown is empty", () => {
    const grid = buildPickGrid(base({ entries: [entry("a", "Ann")], picks: [pick("a", 6, null, null)] }));
    expect(grid.rows[0]!.cells).toEqual([{ kind: "empty" }, { kind: "hidden" }]);
  });

  it("ignores picks in weeks that are not columns", () => {
    const grid = buildPickGrid(base({ entries: [entry("a", "Ann")], picks: [pick("a", 3, "KC", "win")] }));
    expect(grid.rows[0]!.cells).toEqual([{ kind: "empty" }, { kind: "empty" }]);
  });

  it("puts the viewer first, then alive players A to Z, then the eliminated with the latest exit first", () => {
    const grid = buildPickGrid(
      base({
        entries: [
          entry("1", "Zed"),
          entry("2", "Amy"),
          entry("3", "Out Early", { status: "eliminated", eliminatedWeek: 5 }),
          entry("4", "Out Late", { status: "eliminated", eliminatedWeek: 6 }),
          entry("5", "Yolanda You", { isYou: true }),
        ],
      })
    );
    expect(grid.rows.map((r) => r.name)).toEqual(["Yolanda You", "Amy", "Zed", "Out Late", "Out Early"]);
  });

  it("names the most picked team of each week among the picks shown, with its share of pickers", () => {
    const grid = buildPickGrid(
      base({
        entries: [entry("a", "A"), entry("b", "B"), entry("c", "C"), entry("d", "D")],
        picks: [pick("a", 5, "KC"), pick("b", 5, "KC"), pick("c", 5, "DET"), pick("d", 5, null, null)],
      })
    );
    // d's pick is not shown, so it is not counted: KC has 2 of the 3 pickers shown.
    expect(grid.mostPicked).toEqual([{ team: "KC", sharePercent: 67 }, null]);
  });

  it("counts the viewer's own teams used, and says when repeats are allowed", () => {
    const own = [
      { weekNumber: 1, teamCode: "KC" },
      { weekNumber: 2, teamCode: "DET" },
      { weekNumber: 3, teamCode: "KC" },
    ];
    const grid = buildPickGrid(base({ entries: [entry("a", "Ann", { isYou: true })], ownPicks: own }));
    expect(grid.teamsUsed).toEqual({ used: 2, total: 32, repeatsAllowed: false });
    expect(buildPickGrid(base({ entries: [entry("a", "Ann", { isYou: true })], ownPicks: own, repeatsAllowed: true })).teamsUsed?.repeatsAllowed).toBe(true);
  });

  it("gives no teams-used line to a viewer without an entry", () => {
    expect(buildPickGrid(base({ entries: [entry("a", "Ann")] })).teamsUsed).toBeNull();
  });

  it("a late-start pool with no weeks has an empty grid", () => {
    const grid = buildPickGrid(base({ weeks: [], entries: [entry("a", "Ann")] }));
    expect(grid.weeks).toEqual([]);
    expect(grid.rows[0]!.cells).toEqual([]);
  });
});

describe("buildPickGrid: pick 'em", () => {
  const picks = [
    pick("a", 5, "KC", "win"),
    pick("a", 5, "DET", "win"),
    pick("a", 5, "PHI", "loss"),
    pick("b", 5, "BUF", "win"),
    pick("b", 5, "NYJ", "tie"),
    pick("c", 5, "SEA", "win"),
    pick("a", 6, "SF", "win"),
  ];
  const entries = [entry("a", "Ann"), entry("b", "Bob"), entry("c", "Cat"), entry("d", "Dan", { isYou: true })];

  it("shows correct picks out of the week's games, with a total and shared ranks", () => {
    const grid = buildPickGrid(base({ pool: pickEmPool, entries, picks }));
    const a = grid.rows.find((r) => r.entryId === "a")!;
    expect(a.cells).toEqual([{ kind: "points", correct: 2, of: 15 }, { kind: "points", correct: 1, of: 14 }]);
    expect(a.total).toBe(3);
    // Bob and Cat tie on 1 (a tie does not count by default); Dan has none.
    const bob = grid.rows.find((r) => r.entryId === "b")!;
    const cat = grid.rows.find((r) => r.entryId === "c")!;
    expect(bob.total).toBe(1);
    expect([bob.rank, bob.tied]).toEqual([2, true]);
    expect([cat.rank, cat.tied]).toEqual([2, true]);
    expect(a.rank).toBe(1);
  });

  it("counts a tied game as correct when the pool says so", () => {
    const grid = buildPickGrid(base({ pool: pickEmPool, entries, picks, tieCounts: true }));
    expect(grid.rows.find((r) => r.entryId === "b")!.total).toBe(2);
  });

  it("pins the viewer's row first, and has no most-picked row or teams-used line", () => {
    const grid = buildPickGrid(base({ pool: pickEmPool, entries, picks }));
    expect(grid.rows[0]!.isYou).toBe(true);
    expect(grid.rows.slice(1).map((r) => r.name)).toEqual(["Ann", "Bob", "Cat"]);
    expect(grid.mostPicked).toEqual([null, null]);
    expect(grid.teamsUsed).toBeNull();
  });

  it("an unrevealed pick adds nothing to a player's week", () => {
    const grid = buildPickGrid(base({ pool: pickEmPool, entries: [entry("a", "Ann")], picks: [pick("a", 5, "KC", "win"), pick("a", 5, null, null)] }));
    expect(grid.rows[0]!.cells[0]).toEqual({ kind: "points", correct: 1, of: 15 });
  });
});
