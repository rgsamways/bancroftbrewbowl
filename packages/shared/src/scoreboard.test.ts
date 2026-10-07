import { describe, expect, it } from "vitest";
import { scoreboardPollMs, scoreboardTtlMs, sortScoreboardGames } from "./scoreboard.js";

const g = (state: "upcoming" | "live" | "final", kickoff: string) => ({ state, kickoff });
const NOW = Date.parse("2026-10-08T18:00:00Z");

describe("sortScoreboardGames", () => {
  it("puts live first, then upcoming, then final, each by kickoff", () => {
    const sorted = sortScoreboardGames([
      g("final", "2026-10-08T16:00:00Z"),
      g("upcoming", "2026-10-08T23:00:00Z"),
      g("live", "2026-10-08T17:00:00Z"),
      g("upcoming", "2026-10-08T20:00:00Z"),
      g("final", "2026-10-08T13:00:00Z"),
    ]);
    expect(sorted.map((x) => `${x.state}@${x.kickoff.slice(11, 13)}`)).toEqual(["live@17", "upcoming@20", "upcoming@23", "final@13", "final@16"]);
  });
});

describe("scoreboardTtlMs and scoreboardPollMs", () => {
  it("is short while a game is live, a minute when one starts within half an hour, ten minutes otherwise", () => {
    expect(scoreboardTtlMs([g("live", "2026-10-08T17:00:00Z")], NOW)).toBe(20_000);
    expect(scoreboardTtlMs([g("upcoming", "2026-10-08T18:20:00Z")], NOW)).toBe(60_000);
    expect(scoreboardTtlMs([g("upcoming", "2026-10-08T22:00:00Z")], NOW)).toBe(600_000);
    expect(scoreboardTtlMs([g("final", "2026-10-08T14:00:00Z")], NOW)).toBe(600_000);
    expect(scoreboardTtlMs([], NOW)).toBe(600_000);
  });

  it("the screen asks every 30 seconds while a game is live and every five minutes otherwise", () => {
    expect(scoreboardPollMs([{ state: "upcoming" }, { state: "live" }])).toBe(30_000);
    expect(scoreboardPollMs([{ state: "upcoming" }, { state: "final" }])).toBe(300_000);
    expect(scoreboardPollMs([])).toBe(300_000);
  });
});
