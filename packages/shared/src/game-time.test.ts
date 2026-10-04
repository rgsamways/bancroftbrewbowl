import { describe, expect, it } from "vitest";
import { dayHeading, easternDayKey, formatCountdown, formatKickoff, formatKickoffTime } from "./game-time.js";
import { formatRank, rankOf, rankWithTies } from "./rank.js";

describe("Eastern time", () => {
  it("shows a known UTC kickoff on the Eastern clock (EDT, UTC-4)", () => {
    // Sunday 2026-10-04 17:00 UTC is 1:00 PM Eastern.
    expect(dayHeading("2026-10-04T17:00:00.000Z")).toBe("Sunday");
    expect(formatKickoffTime("2026-10-04T17:00:00.000Z")).toBe("1:00 PM");
    expect(formatKickoff("2026-10-04T17:00:00.000Z")).toBe("Sun 1:00 PM");
  });

  it("uses standard time after the clocks change (EST, UTC-5)", () => {
    expect(formatKickoffTime("2026-11-08T18:00:00.000Z")).toBe("1:00 PM");
  });

  it("puts a late Monday night game on Monday, not Tuesday, in Eastern time", () => {
    // 2026-10-06 00:15 UTC is Monday 8:15 PM Eastern.
    expect(dayHeading("2026-10-06T00:15:00.000Z")).toBe("Monday");
    expect(easternDayKey("2026-10-06T00:15:00.000Z")).toBe(easternDayKey("2026-10-05T16:00:00.000Z"));
    expect(easternDayKey("2026-10-06T00:15:00.000Z")).not.toBe(easternDayKey("2026-10-04T17:00:00.000Z"));
  });
});

describe("formatCountdown", () => {
  const m = 60_000;
  it("formats days, hours and minutes", () => {
    expect(formatCountdown(((2 * 24 + 14) * 60 + 37) * m)).toBe("2d 14h 37m");
    expect(formatCountdown((3 * 60 + 5) * m)).toBe("3h 5m");
    expect(formatCountdown(12 * m)).toBe("12m");
  });
  it("says less than a minute under a minute and never goes negative", () => {
    expect(formatCountdown(59_000)).toBe("less than a minute");
    expect(formatCountdown(0)).toBe("less than a minute");
    expect(formatCountdown(-5000)).toBe("less than a minute");
  });
});

describe("rank", () => {
  it("shares a rank among ties and skips the next", () => {
    const ranks = rankWithTies([40, 35, 31, 31, 31, 31, 20]);
    expect(ranks.map((r) => r.rank)).toEqual([1, 2, 3, 3, 3, 3, 7]);
    expect(ranks.map((r) => r.tied)).toEqual([false, false, true, true, true, true, false]);
  });
  it("ranks everyone T1 when all have zero points", () => {
    expect(rankWithTies([0, 0, 0])).toEqual([
      { rank: 1, tied: true },
      { rank: 1, tied: true },
      { rank: 1, tied: true },
    ]);
  });
  it("ranks one score among all scores", () => {
    expect(rankOf(31, [40, 31, 31, 10])).toEqual({ rank: 2, tied: true });
  });
  it("formats ranks", () => {
    expect(formatRank({ rank: 4, tied: true })).toBe("T4");
    expect(formatRank({ rank: 4, tied: false })).toBe("4");
    expect(formatRank({ rank: 4, tied: true }, "ordinal")).toBe("Tied for 4th");
    expect(formatRank({ rank: 1, tied: false }, "ordinal")).toBe("1st");
    expect(formatRank({ rank: 12, tied: false }, "ordinal")).toBe("12th");
    expect(formatRank({ rank: 22, tied: false }, "ordinal")).toBe("22nd");
  });
});
