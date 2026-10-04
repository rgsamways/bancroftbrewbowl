import { describe, expect, it } from "vitest";
import { biggestUpset, latestRecapWeek } from "./recap.js";
import type { SeasonWeek } from "./entry-state.js";

const at = (h: number) => new Date(Date.UTC(2026, 8, 1, h));
const game = (home: string, away: string, result: string, h: number) => ({ homeTeam: home, awayTeam: away, result, kickoffTime: at(h) });
const counts = (teams: Record<string, number>, pickers: number) => ({
  pickers,
  teams: Object.entries(teams).map(([team, picks]) => ({ team, picks })),
});

describe("biggestUpset", () => {
  it("is the winner the fewest players picked", () => {
    const games = [game("KC", "BUF", "home_win", 1), game("DET", "NYJ", "away_win", 2), game("PHI", "DAL", "home_win", 3)];
    expect(biggestUpset(games, counts({ KC: 3, DET: 1, PHI: 1 }, 5))).toEqual({ winner: "NYJ", loser: "DET" });
  });

  it("on equal shares prefers the game whose loser more players picked, then the earlier kickoff", () => {
    const games = [game("KC", "BUF", "home_win", 1), game("DET", "NYJ", "away_win", 2), game("PHI", "DAL", "home_win", 3)];
    expect(biggestUpset([games[0]!, games[1]!], counts({ DET: 4, BUF: 1 }, 5))).toEqual({ winner: "NYJ", loser: "DET" });
    // Fully equal: the earlier kickoff.
    expect(biggestUpset([games[1]!, games[0]!], counts({ PHI: 1 }, 1))).toEqual({ winner: "KC", loser: "BUF" });
  });

  it("is null when nobody picked, or no game has a winner", () => {
    expect(biggestUpset([game("KC", "BUF", "home_win", 1)], counts({}, 0))).toBeNull();
    expect(biggestUpset([game("KC", "BUF", "tie", 1)], counts({ KC: 1 }, 1))).toBeNull();
    expect(biggestUpset([game("KC", "BUF", "home_win", 1)], null)).toBeNull();
  });
});

describe("latestRecapWeek", () => {
  const week = (weekNumber: number, gamesPending: number): SeasonWeek => ({ weekNumber, lockTime: at(0), gamesTotal: 1, gamesPending });

  it("is the latest decided week that had picks", () => {
    const weeks = [week(1, 0), week(2, 0), week(3, 0), week(4, 1)];
    expect(latestRecapWeek(weeks, new Set([2, 4]))).toBe(2);
    expect(latestRecapWeek(weeks, new Set([1, 2, 3]))).toBe(3);
  });

  it("is null with no picks or no decided week", () => {
    expect(latestRecapWeek([week(1, 0)], new Set())).toBeNull();
    expect(latestRecapWeek([week(1, 1)], new Set([1]))).toBeNull();
    expect(latestRecapWeek(undefined, undefined)).toBeNull();
  });
});
