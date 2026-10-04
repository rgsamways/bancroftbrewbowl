import { afterEach, describe, expect, it } from "vitest";
import { cleanupFixtures, createGame } from "../test/fixtures.js";
import { getLockedWeeks, getWeekLockTime } from "./pick-lock.js";

const SEASON = 2998; // a season no real data uses (the fixtures default to 2999)
const HOUR = 60 * 60 * 1000;

describe("pick lock lookup", () => {
  const gameIds: string[] = [];
  afterEach(async () => {
    await cleanupFixtures([], gameIds.splice(0));
  });

  // A game is unique per season, week and matchup, so each one gets its own pairing.
  const matchups = [["KC", "BUF"], ["PHI", "DAL"], ["MIA", "NYJ"], ["SF", "SEA"], ["GB", "CHI"], ["DET", "LAR"]] as const;
  let next = 0;
  const game = async (weekNumber: number, hoursFromNow: number) => {
    const [homeTeam, awayTeam] = matchups[next++ % matchups.length]!;
    const g = await createGame({
      seasonYear: SEASON,
      weekNumber,
      homeTeam,
      awayTeam,
      kickoffTime: new Date(Date.now() + hoursFromNow * HOUR),
    });
    gameIds.push(g.id);
    return g;
  };

  it("locks a week at its earliest kickoff, not a later one", async () => {
    await game(1, 72);
    await game(1, 24);
    await game(1, 48);
    const lock = await getWeekLockTime(SEASON, 1);
    expect(lock).not.toBeNull();
    expect(Math.abs(lock!.getTime() - (Date.now() + 24 * HOUR))).toBeLessThan(5000);
  });

  it("returns null for a week with no games", async () => {
    expect(await getWeekLockTime(SEASON, 9)).toBeNull();
  });

  it("reports only weeks whose first kickoff has passed as locked", async () => {
    await game(1, -48); // already kicked off
    await game(2, 48); // not yet
    await game(3, -1); // kicked off an hour ago, with a later game still to play
    await game(3, 30);
    const locked = await getLockedWeeks(SEASON);
    expect([...locked].sort()).toEqual([1, 3]);
  });

  it("treats a kickoff exactly at the current time as locked", async () => {
    const now = new Date();
    await createGame({ seasonYear: SEASON, weekNumber: 4, homeTeam: "KC", awayTeam: "BUF", kickoffTime: now }).then((g) => gameIds.push(g.id));
    expect((await getLockedWeeks(SEASON, now)).has(4)).toBe(true);
  });

  it("only looks at the season asked about", async () => {
    await game(1, -48);
    expect((await getLockedWeeks(SEASON + 100)).size).toBe(0);
  });
});
