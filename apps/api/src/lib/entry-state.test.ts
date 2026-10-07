import { describe, expect, it } from "vitest";
import { currentWeek, deriveEntryState, picksNeededFor, type SeasonWeek } from "./entry-state.js";

const at = (iso: string) => new Date(iso);
const week = (weekNumber: number, lock: string, pending: number, total = 3): SeasonWeek => ({
  weekNumber,
  lockTime: at(lock),
  gamesTotal: total,
  gamesPending: pending,
});

const weeks = [week(1, "2026-09-10T17:00:00Z", 0), week(2, "2026-09-17T17:00:00Z", 3)];

function derive(over: Partial<Parameters<typeof deriveEntryState>[0]> & { made?: number; needed?: number }) {
  return deriveEntryState({
    entryStatus: "alive",
    poolStatus: "active",
    weeks,
    picksMadeThisWeek: () => over.made ?? 0,
    picksNeeded: () => over.needed ?? 1,
    now: at("2026-09-15T12:00:00Z"),
    ...over,
  });
}

describe("currentWeek", () => {
  it("is the first week not completely decided", () => {
    expect(currentWeek(weeks)?.weekNumber).toBe(2);
  });
  it("is null when every week is decided or there are none", () => {
    expect(currentWeek([week(1, "2026-09-10T17:00:00Z", 0)])).toBeNull();
    expect(currentWeek([])).toBeNull();
    expect(currentWeek(undefined)).toBeNull();
  });
});

describe("deriveEntryState", () => {
  it("needs picks before the lock when nothing is picked", () => {
    const r = derive({});
    expect(r.state).toBe("needs_picks");
    expect(r.week?.weekNumber).toBe(2);
  });

  it("is picked once every pick is in, and not picked with one of two in a double-pick week", () => {
    expect(derive({ made: 1, needed: 1 }).state).toBe("picked");
    expect(derive({ made: 1, needed: 2 }).state).toBe("needs_picks");
    expect(derive({ made: 2, needed: 2 }).state).toBe("picked");
  });

  it("is locked from the first kickoff while games are still being played", () => {
    expect(derive({ now: at("2026-09-17T17:00:00Z"), made: 1 }).state).toBe("locked");
    expect(derive({ now: at("2026-09-20T12:00:00Z") }).state).toBe("locked");
  });

  it("is eliminated whatever the week, and nothing else about lives is exposed", () => {
    const r = derive({ entryStatus: "eliminated", made: 1 });
    expect(r).toEqual({ state: "eliminated", week: null, picksMade: 0, picksNeeded: 0 });
  });

  it("is season over when every week is decided, or the pool is completed", () => {
    expect(derive({ weeks: [week(1, "2026-09-10T17:00:00Z", 0)] }).state).toBe("season_over");
    expect(derive({ poolStatus: "completed" }).state).toBe("season_over");
  });

  it("has no games when the season has none", () => {
    expect(derive({ weeks: [] }).state).toBe("no_games");
    expect(derive({ weeks: undefined }).state).toBe("no_games");
  });

  it("opens the next week with its own lock time once a week is decided", () => {
    const r = derive({ now: at("2026-09-12T12:00:00Z") });
    expect(r.state).toBe("needs_picks");
    expect(r.week?.lockTime).toEqual(at("2026-09-17T17:00:00Z"));
  });

  it("caps picks made at what is needed", () => {
    expect(derive({ made: 5, needed: 2 }).picksMade).toBe(2);
  });
});

describe("picksNeededFor", () => {
  it("is 1 for survivor, 2 in a double-pick week, and the game count for pick 'em", () => {
    const w = week(9, "2026-11-01T17:00:00Z", 3, 14);
    expect(picksNeededFor("survivor", [], w)).toBe(1);
    expect(picksNeededFor("survivor", [9], w)).toBe(2);
    expect(picksNeededFor("pick_em", [], w)).toBe(14);
  });
});

describe("deriveEntryState for a pool that locks each pick at its own game", () => {
  // Week 2: Thursday (started), Sunday (open), Monday (open). Now is Sunday morning.
  const wk = [week(1, "2026-09-10T17:00:00Z", 0), week(2, "2026-09-17T00:15:00Z", 3)];
  const games = [
    { homeTeam: "KC", awayTeam: "BUF", kickoffTime: "2026-09-17T00:15:00Z", result: "pending" },
    { homeTeam: "DET", awayTeam: "NYJ", kickoffTime: "2026-09-20T17:00:00Z", result: "pending" },
    { homeTeam: "PHI", awayTeam: "DAL", kickoffTime: "2026-09-22T00:15:00Z", result: "pending" },
  ];
  const run = (poolType: "survivor" | "pick_em", pickTeams: string[], over: { needed?: number; now?: string } = {}) =>
    deriveEntryState({
      entryStatus: "alive",
      poolStatus: "active",
      weeks: wk,
      picksMadeThisWeek: () => pickTeams.length,
      picksNeeded: () => over.needed ?? (poolType === "pick_em" ? 3 : 1),
      now: at(over.now ?? "2026-09-20T12:00:00Z"),
      perGame: () => ({ poolType, games, pickTeams }),
    });

  it("survivor with no pick still needs one while a later game is open, counting down to the next game", () => {
    const r = run("survivor", []);
    expect(r.state).toBe("needs_picks");
    expect(r.lockTime!.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });

  it("survivor with an open pick is picked, counting down to that pick's own game", () => {
    const r = run("survivor", ["PHI"]);
    expect(r.state).toBe("picked");
    expect(r.lockTime!.toISOString()).toBe("2026-09-22T00:15:00.000Z");
  });

  it("survivor whose pick's game has started is locked, with nothing to count down to", () => {
    const r = run("survivor", ["KC"]);
    expect(r.state).toBe("locked");
    expect(r.lockTime).toBeNull();
  });

  it("a double-pick week with one locked pick and no second still needs picks", () => {
    expect(run("survivor", ["KC"], { needed: 2 }).state).toBe("needs_picks");
    expect(run("survivor", ["KC", "DET"], { needed: 2 }).state).toBe("picked");
  });

  it("pick 'em needs a pick for every game that has not started, and ignores the one that has", () => {
    expect(run("pick_em", ["DET"]).state).toBe("needs_picks");
    expect(run("pick_em", ["DET", "PHI"]).state).toBe("picked");
    expect(run("pick_em", ["DAL", "NYJ"]).state).toBe("picked"); // either team of a game counts
  });

  it("everything started is locked for both pool types", () => {
    expect(run("survivor", [], { now: "2026-09-22T01:00:00Z" }).state).toBe("locked");
    expect(run("pick_em", ["DET"], { now: "2026-09-22T01:00:00Z" }).state).toBe("locked");
  });

  it("a game that has a result counts as started even if its kickoff is still ahead", () => {
    const moved = [{ ...games[1]!, result: "home_win" }, games[2]!, games[0]!];
    const r = deriveEntryState({
      entryStatus: "alive",
      poolStatus: "active",
      weeks: wk,
      picksMadeThisWeek: () => 1,
      picksNeeded: () => 1,
      now: at("2026-09-18T12:00:00Z"),
      perGame: () => ({ poolType: "survivor", games: moved, pickTeams: ["DET"] }),
    });
    expect(r.state).toBe("locked");
  });

  it("is still eliminated first, whatever the games", () => {
    const r = deriveEntryState({
      entryStatus: "eliminated",
      poolStatus: "active",
      weeks: wk,
      picksMadeThisWeek: () => 0,
      picksNeeded: () => 1,
      now: at("2026-09-20T12:00:00Z"),
      perGame: () => ({ poolType: "survivor", games, pickTeams: [] }),
    });
    expect(r.state).toBe("eliminated");
  });
});
