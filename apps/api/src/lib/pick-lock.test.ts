import { afterEach, describe, expect, it } from "vitest";
import { cleanupFixtures, createGame } from "../test/fixtures.js";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { getLockedWeeks, getStartedTeamKeys, getTeamGame, getWeekLockTime, isGameLocked, pickDeadlineRuleOf, revealPredicate } from "./pick-lock.js";

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

describe("per-game locks, on any day of the week", () => {
  const gameIds: string[] = [];
  afterEach(async () => {
    await cleanupFixtures([], gameIds.splice(0));
  });
  const SEASON2 = 2997;
  const mk = async (week: number, home: string, away: string, iso: string, result?: "home_win") => {
    const g = await createGame({ seasonYear: SEASON2, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: new Date(iso) });
    gameIds.push(g.id);
    if (result) await db.update(games).set({ result }).where(eq(games.id, g.id));
    return g;
  };

  it("reads the pool's rule, treating a missing or unknown value as whole-week", () => {
    expect(pickDeadlineRuleOf({ rules: { pick_deadline_rule: "per_game_kickoff" } })).toBe("per_game_kickoff");
    expect(pickDeadlineRuleOf({ rules: { pick_deadline_rule: "first_kickoff_of_week" } })).toBe("first_kickoff_of_week");
    expect(pickDeadlineRuleOf({ rules: {} })).toBe("first_kickoff_of_week");
    expect(pickDeadlineRuleOf({ rules: null })).toBe("first_kickoff_of_week");
    expect(pickDeadlineRuleOf({ rules: { pick_deadline_rule: "whatever" } })).toBe("first_kickoff_of_week");
  });

  it("a game is locked at its kickoff or once it has a result, whatever its kickoff says", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect(isGameLocked({ kickoffTime: new Date("2026-11-27T12:00:00Z"), result: "pending" }, now)).toBe(true);
    expect(isGameLocked({ kickoffTime: new Date("2026-11-27T12:00:01Z"), result: "pending" }, now)).toBe(false);
    expect(isGameLocked({ kickoffTime: new Date("2026-11-29T18:00:00Z"), result: "home_win" }, now)).toBe(true);
  });

  it("works for a holiday week: Wednesday, Thursday, Friday, Saturday, Sunday and Monday games", async () => {
    // Thanksgiving-style week (all UTC): Wed 25th, three on Thu 26th, Fri 27th, Sat 28th, Sun 29th, Mon 30th.
    await mk(12, "KC", "BUF", "2026-11-25T01:00:00Z"); // Wednesday evening Eastern
    await mk(12, "DET", "GB", "2026-11-26T17:30:00Z");
    await mk(12, "DAL", "NYG", "2026-11-26T21:30:00Z");
    await mk(12, "PHI", "CHI", "2026-11-27T01:20:00Z");
    await mk(12, "MIA", "NYJ", "2026-11-27T20:00:00Z"); // Friday
    await mk(12, "SF", "SEA", "2026-11-28T21:30:00Z"); // Saturday
    await mk(12, "LAR", "ARI", "2026-11-29T18:00:00Z"); // Sunday
    await mk(12, "BAL", "CIN", "2026-12-01T01:15:00Z"); // Monday night Eastern

    // The week locks at the Wednesday game (its first kickoff), whatever day that is.
    expect((await getWeekLockTime(SEASON2, 12))!.toISOString()).toBe("2026-11-25T01:00:00.000Z");

    // Friday midday UTC: Wed and Thu games (and the early-Friday one) have started; Friday afternoon, Saturday and later are open.
    const started = await getStartedTeamKeys(SEASON2, new Date("2026-11-27T12:00:00Z"));
    for (const team of ["KC", "BUF", "DET", "GB", "DAL", "NYG", "PHI", "CHI"]) expect(started.has(`12|${team}`)).toBe(true);
    for (const team of ["MIA", "NYJ", "SF", "SEA", "LAR", "ARI", "BAL", "CIN"]) expect(started.has(`12|${team}`)).toBe(false);

    // Looking up a team's game works the same on any day, and a bye has none.
    expect((await getTeamGame(SEASON2, 12, "SEA"))!.homeTeam).toBe("SF");
    expect(await getTeamGame(SEASON2, 12, "DEN")).toBeNull();
  });

  it("a week whose first game is on a Friday locks at that game; later games stay open per game", async () => {
    await mk(1, "KC", "LAC", "2026-09-11T00:15:00Z"); // Friday night Eastern (a Brazil-style game)
    await mk(1, "DET", "NYJ", "2026-09-13T17:00:00Z"); // Sunday
    await mk(1, "BUF", "MIA", "2026-09-15T00:15:00Z"); // Monday night
    expect((await getWeekLockTime(SEASON2, 1))!.toISOString()).toBe("2026-09-11T00:15:00.000Z");
    const started = await getStartedTeamKeys(SEASON2, new Date("2026-09-12T12:00:00Z"));
    expect([...started].sort()).toEqual(["1|KC", "1|LAC"]);
  });

  it("the reveal test follows each game in a per-game pool, and the whole week otherwise", async () => {
    await mk(2, "KC", "BUF", "2026-10-01T00:15:00Z", "home_win");
    await mk(2, "DET", "NYJ", "2099-10-04T17:00:00Z");
    const now = new Date("2026-10-02T12:00:00Z");
    const perGame = await revealPredicate({ seasonYear: SEASON2, rules: { pick_deadline_rule: "per_game_kickoff" } }, now);
    expect(perGame({ weekNumber: 2, teamCode: "KC" })).toBe(true);
    expect(perGame({ weekNumber: 2, teamCode: "DET" })).toBe(false);
    const wholeWeek = await revealPredicate({ seasonYear: SEASON2, rules: { pick_deadline_rule: "first_kickoff_of_week" } }, now);
    expect(wholeWeek({ weekNumber: 2, teamCode: "DET" })).toBe(true);
    // Waiting for the week's last game holds everything in both kinds of pool.
    const waiting = await revealPredicate({ seasonYear: SEASON2, rules: { pick_deadline_rule: "per_game_kickoff", reveal_picks: "after_final_game" } }, now);
    expect(waiting({ weekNumber: 2, teamCode: "KC" })).toBe(false);
  });
});
