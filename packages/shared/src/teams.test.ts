import { describe, expect, it } from "vitest";
import { NFL_TEAM_CODES, readableOn, TEAM_COLORS } from "./teams.js";

describe("TEAM_COLORS", () => {
  it("has a colour for every team, as a hex value", () => {
    for (const code of NFL_TEAM_CODES) expect(TEAM_COLORS[code]).toMatch(/^#[0-9a-f]{6}$/);
    expect(Object.keys(TEAM_COLORS)).toHaveLength(NFL_TEAM_CODES.length);
  });
});

describe("readableOn", () => {
  it("gives white on dark colours and dark ink on light ones", () => {
    expect(readableOn(TEAM_COLORS.CHI)).toBe("#ffffff");
    expect(readableOn(TEAM_COLORS.KC)).toBe("#ffffff");
    expect(readableOn(TEAM_COLORS.PIT)).toBe("#1a0f06");
    expect(readableOn(TEAM_COLORS.NO)).toBe("#1a0f06");
  });
});
