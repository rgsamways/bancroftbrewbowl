import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type AdminSummary } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, wipeoutEvents } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import { chooseNextStep } from "./admin-summary.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const future = (h: number) => new Date(Date.now() + h * HOUR);

describe("chooseNextStep", () => {
  const wipeout = { wipeoutId: "w", poolId: "p", poolName: "P", weekNumber: 1, game: null, candidates: 3 };
  const waiting = [{ id: "g", homeTeam: "KC", awayTeam: "BUF", kickoffTime: "2026-10-04T17:00:00.000Z" }];

  it("says no schedule before anything else", () => {
    expect(chooseNextStep({ seasonYear: null, wipeouts: [wipeout], waitingGames: waiting, hasCurrentWeek: false })).toEqual({ kind: "no_schedule" });
  });
  it("puts a wipeout decision ahead of waiting results", () => {
    expect(chooseNextStep({ seasonYear: 2026, wipeouts: [wipeout], waitingGames: waiting, hasCurrentWeek: true }).kind).toBe("wipeout");
  });
  it("asks for results that are waiting", () => {
    expect(chooseNextStep({ seasonYear: 2026, wipeouts: [], waitingGames: waiting, hasCurrentWeek: true })).toEqual({ kind: "results", waiting });
  });
  it("is caught up with a current week and nothing to do, and complete without a current week", () => {
    expect(chooseNextStep({ seasonYear: 2026, wipeouts: [], waitingGames: [], hasCurrentWeek: true }).kind).toBe("caught_up");
    expect(chooseNextStep({ seasonYear: 2026, wipeouts: [], waitingGames: [], hasCurrentWeek: false }).kind).toBe("season_complete");
  });
});

describe("GET /admin/summary and the wipeout list", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  // The summary looks at the latest season that has games, so these tests use seasons far above
  // anything real or used elsewhere, and a new one each time.
  let nextSeason = 3500;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date) => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    return g;
  };
  const decide = (id: string) => db.update(games).set({ result: "home_win" }).where(eq(games.id, id));
  const summary = async (viewer: User | null) => {
    actAs(viewer ? as(viewer) : null);
    return app.inject({ method: "GET", url: "/admin/summary" });
  };

  it("is for admins only", async () => {
    const player = await person("Plain Player");
    expect((await summary(null)).statusCode).toBe(401);
    expect((await summary(player)).statusCode).toBe(403);
  });

  it("results waiting: only games that have kicked off with no result count", async () => {
    const season = nextSeason++;
    const admin = await person("Sum Admin", true);
    const done = await game(season, 1, "KC", "BUF", future(-30));
    await decide(done.id);
    const past = await game(season, 1, "DAL", "PHI", future(-2));
    await game(season, 1, "SEA", "SF", future(30)); // not played yet
    const body = (await summary(admin)).json() as AdminSummary;
    expect(body).toMatchObject({ seasonYear: season, weekNumber: 1, weekGamesTotal: 3, weekGamesEntered: 1, locked: true, scheduleLoaded: true });
    expect(body.waitingGames.map((g) => g.id)).toEqual([past.id]);
    expect(body.next).toMatchObject({ kind: "results" });
    expect(Date.parse(body.lockTime!)).toBeLessThan(Date.now());
  });

  it("caught up before anything has kicked off, with picks still open", async () => {
    const season = nextSeason++;
    const admin = await person("Sum Admin", true);
    await game(season, 1, "KC", "BUF", future(30));
    const body = (await summary(admin)).json() as AdminSummary;
    expect(body.next.kind).toBe("caught_up");
    expect(body).toMatchObject({ locked: false, weekGamesEntered: 0, waitingGames: [] });
  });

  it("moves to the next week once a week is fully decided, and is complete when all are", async () => {
    const season = nextSeason++;
    const admin = await person("Sum Admin", true);
    const g1 = await game(season, 1, "KC", "BUF", future(-100));
    await decide(g1.id);
    const g2 = await game(season, 2, "DAL", "PHI", future(40));
    let body = (await summary(admin)).json() as AdminSummary;
    expect(body).toMatchObject({ weekNumber: 2, next: { kind: "caught_up" } });
    await decide(g2.id);
    body = (await summary(admin)).json() as AdminSummary;
    expect(body).toMatchObject({ weekNumber: null, next: { kind: "season_complete" } });
  });

  it("a waiting wipeout decision outranks waiting results", async () => {
    const season = nextSeason++;
    const admin = await person("Sum Admin", true);
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, season);
    poolIds.push(pool.id);
    const other = await person("Cand");
    const e1 = await createEntry(pool.id, admin.id);
    const e2 = await createEntry(pool.id, other.id);
    const past = await game(season, 1, "KC", "BUF", future(-2));
    await game(season, 1, "DAL", "PHI", future(-1)); // also waiting
    await db.insert(wipeoutEvents).values({ poolId: pool.id, weekNumber: 1, gameId: past.id, candidateEntryIds: [e1.id, e2.id] });
    const body = (await summary(admin)).json() as AdminSummary;
    expect(body.next.kind).toBe("wipeout");
    expect(body.wipeouts).toHaveLength(1);
    expect(body.wipeouts[0]).toMatchObject({ poolId: pool.id, poolName: pool.name, weekNumber: 1, candidates: 2, game: { homeTeam: "KC", awayTeam: "BUF" } });
    expect(body.waitingGames).toHaveLength(2); // still listed, just not the next step
  });

  it("lists each pool with alive and total players, and whether the season has a survivor pool", async () => {
    const season = nextSeason++;
    const admin = await person("Sum Admin", true);
    const survivor = await createPool("survivor", defaultSurvivorRulesConfig, season);
    const pickem = await createPool("pick_em", defaultPickEmRulesConfig, season);
    poolIds.push(survivor.id, pickem.id);
    for (const n of ["A", "B", "C"]) await createEntry(survivor.id, (await person(n)).id);
    const out = await createEntry(survivor.id, (await person("D")).id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, out.id));
    await game(season, 1, "KC", "BUF", future(24));

    const body = (await summary(admin)).json() as AdminSummary;
    const line = body.pools.find((p) => p.id === survivor.id)!;
    expect(line).toMatchObject({ type: "survivor", alive: 3, total: 4, seasonYear: season });
    expect(body.pools.find((p) => p.id === pickem.id)).toMatchObject({ type: "pick_em", total: 0 });
    expect(body.hasSurvivorPool).toBe(true);
  });

  it("the wipeout list shows what each candidate picked and which one is the viewing admin", async () => {
    const season = nextSeason++;
    const admin = await person("Wipe Admin", true);
    const other = await person("Wipe Other");
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, season);
    poolIds.push(pool.id);
    const mine = await createEntry(pool.id, admin.id);
    const theirs = await createEntry(pool.id, other.id);
    const g = await game(season, 1, "KC", "BUF", future(-2));
    await createPick(mine.id, 1, "KC");
    await createPick(theirs.id, 1, "KC");
    await db.insert(wipeoutEvents).values({ poolId: pool.id, weekNumber: 1, gameId: g.id, candidateEntryIds: [mine.id, theirs.id] });

    actAs(as(admin));
    const res = await app.inject({ method: "GET", url: `/pools/${pool.id}/wipeouts` });
    expect(res.statusCode).toBe(200);
    const [event] = res.json() as { candidateEntries: { id: string; pickedTeams: string[]; isYou: boolean }[] }[];
    const byId = new Map(event!.candidateEntries.map((c) => [c.id, c]));
    expect(byId.get(mine.id)).toMatchObject({ pickedTeams: ["KC"], isYou: true });
    expect(byId.get(theirs.id)).toMatchObject({ pickedTeams: ["KC"], isYou: false });

    actAs(as(other));
    expect((await app.inject({ method: "GET", url: `/pools/${pool.id}/wipeouts` })).statusCode).toBe(403);
  });
});
