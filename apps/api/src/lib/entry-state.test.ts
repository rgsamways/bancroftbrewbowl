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
