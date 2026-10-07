import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type ScoreboardResponse } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import { resetScoreboardCache } from "../lib/scoreboard.js";
import * as espn from "../lib/espn.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));
vi.mock("../lib/espn.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/espn.js")>()),
  fetchEspnScoreboardWeek: vi.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
type EspnGame = import("../lib/espn.js").EspnGame;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, emailVerified: true });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

const espnGame = (home: string, away: string, state: EspnGame["state"], hours: number): EspnGame => ({
  week: 1,
  homeTeam: home as never,
  awayTeam: away as never,
  kickoff: at(hours),
  final: state === "final",
  result: "pending",
  homeScore: null,
  awayScore: null,
  state,
  statusText: state === "live" ? "Q3 4:21" : state === "final" ? "Final" : "",
  homeScoreNow: state === "upcoming" ? null : 21,
  awayScoreNow: state === "upcoming" ? null : 17,
  homeRecord: "3-1",
  awayRecord: "2-2",
  network: "CBS",
});

describe("GET /me/scoreboard", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  const read = vi.mocked(espn.fetchEspnScoreboardWeek);
  const SEASON = 3991; // the latest season in the test database while this file runs

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    resetScoreboardCache();
    read.mockReset();
    read.mockResolvedValue({ games: [espnGame("KC", "BUF", "live", -1), espnGame("DET", "NYJ", "upcoming", 24)], byes: ["CAR" as never] });
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string) => {
    const u = await createUser({ name });
    userIds.push(u.id);
    return u;
  };
  const week = async () => {
    for (const [home, away, hours] of [["BUF", "KC", -1], ["DET", "NYJ", 24]] as const) {
      const g = await createGame({ seasonYear: SEASON, weekNumber: 1, homeTeam: home, awayTeam: away, kickoffTime: at(hours) });
      gameIds.push(g.id);
    }
  };
  const get = async (who: User | null) => {
    actAs(who ? as(who) : null);
    const res = await app.inject({ method: "GET", url: "/me/scoreboard" });
    return { status: res.statusCode, body: res.body, json: res.json() as ScoreboardResponse };
  };

  it("is for signed-in players only", async () => {
    await week();
    expect((await get(null)).status).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it("returns this week's games with scores, status, records, network and byes", async () => {
    await week();
    const me = await person("Me");
    const { status, json } = await get(me);
    expect(status).toBe(200);
    const sb = json.scoreboard!;
    expect(sb).toMatchObject({ seasonYear: SEASON, weekNumber: 1, stale: false, byes: ["CAR"], yourPicks: [] });
    expect(sb.games.map((g) => g.state)).toEqual(["live", "upcoming"]);
    expect(sb.games[0]).toMatchObject({ statusText: "Q3 4:21", homeScore: 21, awayScore: 17, homeRecord: "3-1", network: "CBS" });
    expect(sb.games[1]).toMatchObject({ homeScore: null, awayScore: null });
  });

  it("includes only the player's own picks, per pool, and nothing about anyone else", async () => {
    await week();
    const me = await person("Me Myself");
    const rival = await person("Rival Rick");
    const survivor = await createPool("survivor", defaultSurvivorRulesConfig, SEASON);
    const pickEm = await createPool("pick_em", defaultPickEmRulesConfig, SEASON);
    poolIds.push(survivor.id, pickEm.id);
    const mineA = await createEntry(survivor.id, me.id);
    const mineB = await createEntry(pickEm.id, me.id);
    const theirs = await createEntry(survivor.id, rival.id);
    await createPick(mineA.id, 1, "KC");
    await createPick(mineB.id, 1, "DET");
    await createPick(mineB.id, 1, "NYJ");
    await createPick(theirs.id, 1, "BUF");

    const { json, body } = await get(me);
    const picks = json.scoreboard!.yourPicks;
    expect(picks).toHaveLength(2);
    expect(picks.find((p) => p.poolId === survivor.id)!.teams).toEqual(["KC"]);
    expect(picks.find((p) => p.poolId === pickEm.id)!.teams.sort()).toEqual(["DET", "NYJ"]);
    expect(body).not.toContain("Rival");
    expect(JSON.stringify(picks)).not.toContain("BUF");
  });

  it("never carries betting odds or lines, even if ESPN's payload had them", async () => {
    await week();
    read.mockResolvedValue({
      games: [{ ...espnGame("KC", "BUF", "upcoming", 5), odds: [{ details: "KC -3.5", overUnder: 47 }] } as EspnGame],
      byes: [],
    });
    const me = await person("Me");
    const { body } = await get(me);
    expect(body).not.toMatch(/odds|overUnder|3\.5|spread|line/i);
  });

  it("answers with no scoreboard, not an error, when ESPN lists nothing or fails", async () => {
    const me = await person("Me");
    read.mockResolvedValue({ games: [], byes: [] });
    expect((await get(me)).json).toEqual({ scoreboard: null });
    resetScoreboardCache();
    read.mockRejectedValue(new Error("ESPN down"));
    const failed = await get(me);
    expect(failed.status).toBe(200);
    expect(failed.json).toEqual({ scoreboard: null });
  });
});
