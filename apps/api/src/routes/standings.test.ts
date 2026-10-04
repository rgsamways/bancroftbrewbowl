import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type PoolStandings } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const future = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("standings", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2960;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const user = async (name: string) => {
    const u = await createUser({ name });
    userIds.push(u.id);
    return u;
  };
  const pool = async (type: "survivor" | "pick_em", season: number, extra: object = {}) => {
    const p =
      type === "survivor"
        ? await createPool("survivor", defaultSurvivorRulesConfig, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, ...extra }, season);
    poolIds.push(p.id);
    return p;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date) => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    return g;
  };
  const standings = async (viewer: User | null, poolId: string) => {
    actAs(viewer ? as(viewer) : null);
    return app.inject({ method: "GET", url: `/pools/${poolId}/standings` });
  };

  it("refuses a signed-out request and an unknown pool", async () => {
    const p = await pool("survivor", nextSeason++);
    expect((await standings(null, p.id)).statusCode).toBe(401);
    const viewer = await user("Viewer");
    expect((await standings(viewer, crypto.randomUUID())).statusCode).toBe(404);
  });

  it("survivor: counts, the viewer first, the rest A to Z, eliminated most recent first", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Zed Viewer");
    const names = ["Beth", "aaron", "Chris"];
    for (const n of names) await createEntry(p.id, (await user(n)).id);
    const mine = await createEntry(p.id, me.id);
    const out2 = await createEntry(p.id, (await user("Out Two")).id);
    const out4a = await createEntry(p.id, (await user("Out Four B")).id);
    const out4b = await createEntry(p.id, (await user("Out Four A")).id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 2 }).where(eq(entries.id, out2.id));
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 4 }).where(eq(entries.id, out4a.id));
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 4 }).where(eq(entries.id, out4b.id));
    // Weeks 1 to 4 decided, week 5 still to play.
    for (let w = 1; w <= 4; w++) {
      const g = await game(season, w, "KC", "BUF", future(-500 + w));
      await db.update(games).set({ result: "home_win" }).where(eq(games.id, g.id));
    }
    await game(season, 5, "KC", "BUF", future(24));

    const res = await standings(me, p.id);
    expect(res.statusCode).toBe(200);
    const body = res.json() as PoolStandings;
    expect(body.pool).toMatchObject({ id: p.id, type: "survivor", poolTotalCents: null });
    expect(body.playersTotal).toBe(7);
    expect(body.lastDecidedWeek).toBe(4);
    expect(body.seasonOver).toBe(false);
    expect(body.me).toEqual({ entryId: mine.id, status: "alive" });
    expect(body.alive.map((r) => r.name)).toEqual(["Zed Viewer", "aaron", "Beth", "Chris"]);
    expect(body.alive[0]!.isYou).toBe(true);
    expect(body.alive.slice(1).every((r) => !r.isYou)).toBe(true);
    expect(body.eliminated.map((r) => [r.name, r.eliminatedWeek])).toEqual([
      ["Out Four A", 4],
      ["Out Four B", 4],
      ["Out Two", 2],
    ]);
    expect(body.leaderboard).toEqual([]);
  });

  it("survivor: an eliminated viewer is marked out, and someone with no entry has no 'me'", async () => {
    const p = await pool("survivor", nextSeason++);
    const me = await user("Me Out");
    const mine = await createEntry(p.id, me.id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, mine.id));
    await createEntry(p.id, (await user("Other")).id);
    expect(((await standings(me, p.id)).json() as PoolStandings).me).toEqual({ entryId: mine.id, status: "eliminated" });

    const stranger = await user("Stranger");
    const body = (await standings(stranger, p.id)).json() as PoolStandings;
    expect(body.me).toBeNull();
    expect(body.alive.some((r) => r.isYou)).toBe(false);
  });

  it("the week line: before any week is decided, partly decided, and the season over", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    await createEntry(p.id, me.id);
    expect(((await standings(me, p.id)).json() as PoolStandings).lastDecidedWeek).toBeNull(); // no games at all

    const g1 = await game(season, 1, "KC", "BUF", future(-300));
    const g2 = await game(season, 2, "DAL", "PHI", future(24));
    let body = (await standings(me, p.id)).json() as PoolStandings;
    expect(body.lastDecidedWeek).toBeNull();
    expect(body.seasonOver).toBe(false);

    await db.update(games).set({ result: "home_win" }).where(eq(games.id, g1.id));
    body = (await standings(me, p.id)).json() as PoolStandings;
    expect(body.lastDecidedWeek).toBe(1);
    expect(body.seasonOver).toBe(false);

    await db.update(games).set({ result: "away_win" }).where(eq(games.id, g2.id));
    body = (await standings(me, p.id)).json() as PoolStandings;
    expect(body.lastDecidedWeek).toBe(2);
    expect(body.seasonOver).toBe(true);
  });

  it("pick 'em: points, shared ranks that skip, and the leader's points", async () => {
    const season = nextSeason++;
    const p = await pool("pick_em", season);
    const scores: [string, number][] = [
      ["Dave", 38],
      ["Sandra", 36],
      ["Big Mike", 33],
      ["Robin", 31],
      ["Priya", 31],
      ["Tom", 28],
    ];
    const people: Record<string, { user: User; entryId: string }> = {};
    for (const [name, pts] of scores) {
      const u = await user(name);
      const e = await createEntry(p.id, u.id);
      people[name] = { user: u, entryId: e.id };
      // Each point is one winning pick, in its own week so the (entry, week, team) rows are unique.
      for (let w = 1; w <= pts; w++) {
        const pick = await createPick(e.id, w, "KC");
        await db.update(picks).set({ result: "win" }).where(eq(picks.id, pick.id));
      }
    }
    const body = (await standings(people["Robin"]!.user, p.id)).json() as PoolStandings;
    expect(body.leaderPoints).toBe(38);
    expect(body.leaderboard.map((r) => [r.name, r.points, r.rank, r.tied])).toEqual([
      ["Dave", 38, 1, false],
      ["Sandra", 36, 2, false],
      ["Big Mike", 33, 3, false],
      ["Priya", 31, 4, true],
      ["Robin", 31, 4, true],
      ["Tom", 28, 6, false],
    ]);
    expect(body.me).toMatchObject({ points: 31, rank: 4, tied: true });
    expect(body.leaderboard.find((r) => r.name === "Robin")!.isYou).toBe(true);
    expect(body.alive).toEqual([]);
  });

  it("pick 'em: a tied game scores only when the pool counts ties as correct", async () => {
    const season = nextSeason++;
    const p = await pool("pick_em", season, { tie_handling: "everyone_correct" });
    const me = await user("Me");
    const e = await createEntry(p.id, me.id);
    const pick = await createPick(e.id, 1, "KC");
    await db.update(picks).set({ result: "tie" }).where(eq(picks.id, pick.id));
    const body = (await standings(me, p.id)).json() as PoolStandings;
    expect(body.me).toMatchObject({ points: 1, rank: 1, tied: false });
  });

  it("returns no email address and no picks, for either pool type", async () => {
    const season = nextSeason++;
    const s = await pool("survivor", season);
    const pe = await pool("pick_em", season);
    const me = await user("Me Viewer");
    const rival = await user("Rival Player");
    const mine = await createEntry(s.id, me.id);
    const rivalEntry = await createEntry(s.id, rival.id);
    await createEntry(pe.id, me.id);
    const rivalPickEm = await createEntry(pe.id, rival.id);
    await game(season, 1, "KC", "BUF", future(24));
    await createPick(rivalEntry.id, 1, "BUF");
    await createPick(mine.id, 1, "KC");
    await createPick(rivalPickEm.id, 1, "BUF");

    for (const id of [s.id, pe.id]) {
      const text = (await standings(me, id)).body;
      expect(text).not.toContain(rival.email);
      expect(text).not.toContain(me.email);
      expect(text).not.toContain("teamCode");
      expect(text).not.toContain("BUF");
    }
  });

  it("an admin can read any pool's standings without an entry in it", async () => {
    const p = await pool("survivor", nextSeason++);
    await createEntry(p.id, (await user("Player")).id);
    const admin = await createUser({ name: "Admin", isAdmin: true });
    userIds.push(admin.id);
    const body = (await standings(admin, p.id)).json() as PoolStandings;
    expect(body.me).toBeNull();
    expect(body.playersTotal).toBe(1);
  });
});
