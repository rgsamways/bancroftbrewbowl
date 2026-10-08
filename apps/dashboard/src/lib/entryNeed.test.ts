import { describe, expect, it } from "vitest";
import { entryNeed, entryStanding } from "./entryNeed.js";

const LOCK = "2026-10-09T00:15:00Z"; // Thursday 8:15 PM Eastern

describe("entryNeed", () => {
  it("says when a pick is due", () => {
    expect(entryNeed({ state: "needs_picks", poolType: "survivor", lockTime: LOCK })).toBe("Pick due Thu 8:15 PM");
    expect(entryNeed({ state: "needs_picks", poolType: "pick_em", lockTime: LOCK })).toBe("Picks due Thu 8:15 PM");
  });

  it("copes with no lock time", () => {
    expect(entryNeed({ state: "needs_picks", poolType: "survivor", lockTime: null })).toBe("Pick needed");
  });

  it("covers every other state", () => {
    expect(entryNeed({ state: "picked", poolType: "survivor", lockTime: LOCK })).toBe("Pick made");
    expect(entryNeed({ state: "picked", poolType: "pick_em", lockTime: LOCK })).toBe("Picks made");
    expect(entryNeed({ state: "locked", poolType: "survivor", lockTime: null })).toBe("Locked");
    expect(entryNeed({ state: "eliminated", poolType: "survivor", lockTime: null })).toBe("Out");
    expect(entryNeed({ state: "season_over", poolType: "pick_em", lockTime: null })).toBe("Season over");
    expect(entryNeed({ state: "no_games", poolType: "survivor", lockTime: null })).toBe("No games yet");
  });
});

describe("entryStanding", () => {
  const base = { eliminatedWeek: null, points: null, rank: null, tied: false };

  it("describes survivor entries", () => {
    expect(entryStanding({ ...base, poolType: "survivor", status: "alive" })).toBe("Alive");
    expect(entryStanding({ ...base, poolType: "survivor", status: "eliminated", eliminatedWeek: 3 })).toBe("Out in week 3");
    expect(entryStanding({ ...base, poolType: "survivor", status: "eliminated" })).toBe("Out");
  });

  it("describes pick 'em entries with rank and points", () => {
    expect(entryStanding({ ...base, poolType: "pick_em", status: "alive", points: 12, rank: 1 })).toBe("1st · 12 pts");
    expect(entryStanding({ ...base, poolType: "pick_em", status: "alive", points: 1, rank: 2, tied: true })).toBe("T2nd · 1 pt");
    expect(entryStanding({ ...base, poolType: "pick_em", status: "alive", points: 0, rank: 11 })).toBe("11th · 0 pts");
    expect(entryStanding({ ...base, poolType: "pick_em", status: "alive" })).toBe("0 pts");
  });
});
