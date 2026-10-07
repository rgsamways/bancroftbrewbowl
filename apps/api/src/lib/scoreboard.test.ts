import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { cleanupFixtures, createGame } from "../test/fixtures.js";
import { getScoreboard, resetScoreboardCache } from "./scoreboard.js";
import type { EspnGame } from "./espn.js";

const SEASON = 3990; // the latest season in the test database while this file runs
const MINUTE = 60_000;
const T0 = new Date("2026-10-08T18:00:00Z");
const after = (ms: number) => new Date(T0.getTime() + ms);

const espnGame = (home: string, away: string, state: EspnGame["state"], kickoff: Date): EspnGame => ({
  week: 1,
  homeTeam: home as never,
  awayTeam: away as never,
  kickoff,
  final: state === "final",
  result: "pending",
  homeScore: null,
  awayScore: null,
  state,
  statusText: state === "live" ? "Q3 4:21" : state === "final" ? "Final" : "",
  homeScoreNow: state === "upcoming" ? null : 17,
  awayScoreNow: state === "upcoming" ? null : 10,
  homeRecord: "2-2",
  awayRecord: "1-3",
  network: "Prime Video",
});

describe("the shared scoreboard cache", () => {
  const gameIds: string[] = [];
  beforeEach(async () => {
    resetScoreboardCache();
    // One undecided game in week 1, so week 1 is the current week.
    const g = await createGame({ seasonYear: SEASON, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: after(48 * 60 * MINUTE) });
    gameIds.push(g.id);
  });
  afterEach(async () => {
    await cleanupFixtures([], gameIds.splice(0));
  });

  const reader = (list: EspnGame[], byes: string[] = []) => vi.fn(async () => ({ games: list, byes: byes as never }));

  it("reads ESPN once and reuses the answer for ten minutes when nothing is on", async () => {
    const read = reader([espnGame("KC", "BUF", "upcoming", after(48 * 60 * MINUTE))], ["CAR"]);
    const first = await getScoreboard(T0, read);
    expect(first).toMatchObject({ seasonYear: SEASON, weekNumber: 1, stale: false, byes: ["CAR"] });
    await getScoreboard(after(9 * MINUTE), read);
    expect(read).toHaveBeenCalledTimes(1);
    await getScoreboard(after(11 * MINUTE), read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reuses a live answer for only about twenty seconds", async () => {
    const read = reader([espnGame("KC", "BUF", "live", after(-60 * MINUTE))]);
    await getScoreboard(T0, read);
    await getScoreboard(after(10_000), read);
    expect(read).toHaveBeenCalledTimes(1);
    await getScoreboard(after(25_000), read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("looks again within a minute when a game is about to start", async () => {
    const read = reader([espnGame("KC", "BUF", "upcoming", after(20 * MINUTE))]);
    await getScoreboard(T0, read);
    await getScoreboard(after(40_000), read);
    expect(read).toHaveBeenCalledTimes(1);
    await getScoreboard(after(70_000), read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("a crowd arriving together shares one read", async () => {
    let release: (v: { games: EspnGame[]; byes: never[] }) => void = () => undefined;
    const read = vi.fn(() => new Promise<{ games: EspnGame[]; byes: never[] }>((resolve) => (release = resolve)));
    const many = Array.from({ length: 25 }, () => getScoreboard(T0, read));
    // Wait until the one shared read has actually started, then let it finish.
    while (read.mock.calls.length === 0) await new Promise((r) => setTimeout(r, 5));
    release({ games: [espnGame("KC", "BUF", "live", after(-30 * MINUTE))], byes: [] });
    const results = await Promise.all(many);
    expect(read).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.games.length === 1)).toBe(true);
  });

  it("orders live games first, then upcoming, then final", async () => {
    const read = reader([
      espnGame("DET", "NYJ", "final", after(-300 * MINUTE)),
      espnGame("PHI", "DAL", "upcoming", after(120 * MINUTE)),
      espnGame("KC", "BUF", "live", after(-60 * MINUTE)),
    ]);
    const sb = await getScoreboard(T0, read);
    expect(sb!.games.map((g) => g.state)).toEqual(["live", "upcoming", "final"]);
  });

  it("when ESPN fails it serves the last good answer, marked stale, for an hour, then nothing", async () => {
    const good = reader([espnGame("KC", "BUF", "live", after(-60 * MINUTE))]);
    await getScoreboard(T0, good);
    const failing = vi.fn(async () => {
      throw new Error("ESPN is down");
    });
    // Past the live cache time, so it tries ESPN again and fails.
    const hiccup = await getScoreboard(after(5 * MINUTE), failing);
    expect(hiccup).toMatchObject({ stale: true, asOf: T0 });
    expect(hiccup!.games).toHaveLength(1);
    expect(await getScoreboard(after(61 * MINUTE), failing)).toBeNull();
  });

  it("a first read that fails gives no scoreboard, and never throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("ESPN is down");
    });
    await expect(getScoreboard(T0, failing)).resolves.toBeNull();
  });

  it("has no scoreboard when every game of the season is decided", async () => {
    for (const id of gameIds) await db.update(games).set({ result: "home_win" }).where(eq(games.id, id));
    const read = reader([]);
    expect(await getScoreboard(T0, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("asks again when the current week changes", async () => {
    const read = reader([espnGame("KC", "BUF", "upcoming", after(48 * 60 * MINUTE))]);
    await getScoreboard(T0, read);
    // Week 1 gets decided and week 2 opens.
    for (const id of gameIds) await db.update(games).set({ result: "home_win" }).where(eq(games.id, id));
    const next = await createGame({ seasonYear: SEASON, weekNumber: 2, homeTeam: "DET", awayTeam: "NYJ", kickoffTime: after(10 * 24 * 60 * MINUTE) });
    gameIds.push(next.id);
    const sb = await getScoreboard(after(MINUTE), read);
    expect(sb?.weekNumber).toBe(2);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
