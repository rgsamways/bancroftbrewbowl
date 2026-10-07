import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type MeSummary, type PickSheet, type PoolTv } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { adminActivity, pools } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("a part-locked week in a per-game pool", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2860;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    if (userIds.length > 0) await db.delete(adminActivity).where(inArray(adminActivity.actorId, userIds));
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const get = async <T>(viewer: User, url: string) => {
    actAs(as(viewer));
    return (await app.inject({ method: "GET", url })).json() as T;
  };

  // Week 1: KC at BUF started two hours ago; DET-NYJ in a day; PHI-DAL in two days.
  const scene = async (type: "survivor" | "pick_em", rule: "per_game_kickoff" | "first_kickoff_of_week" = "per_game_kickoff") => {
    const season = nextSeason++;
    const p =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, pick_deadline_rule: rule }, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, pick_deadline_rule: rule }, season);
    poolIds.push(p.id);
    const game = async (home: string, away: string, hours: number) => {
      const g = await createGame({ seasonYear: season, weekNumber: 1, homeTeam: home, awayTeam: away, kickoffTime: at(hours) });
      gameIds.push(g.id);
      return g;
    };
    await game("BUF", "KC", -2);
    await game("DET", "NYJ", 24);
    await game("PHI", "DAL", 48);
    const me = await person("Me");
    const other = await person("Other");
    const mine = await createEntry(p.id, me.id);
    const theirs = await createEntry(p.id, other.id);
    return { season, pool: p, me, other, mine, theirs };
  };
  const summaryFor = async (u: User) => (await get<MeSummary>(u, "/me/summary")).entries[0]!;

  it("a pool created in the app locks per game; a pool saved before the setting keeps the whole-week rule", async () => {
    const admin = await person("Pool Admin", true);
    actAs(as(admin));
    const res = await app.inject({ method: "POST", url: "/pools", payload: { name: "Zz Per Game Pool", season_year: 2090, type: "survivor" } });
    expect(res.statusCode).toBe(201);
    const created = res.json() as { id: string; rules: { pick_deadline_rule: string } };
    poolIds.push(created.id);
    expect(created.rules.pick_deadline_rule).toBe("per_game_kickoff");
    // The stored default for older data is unchanged.
    const old = await createPool("survivor", defaultSurvivorRulesConfig, 2091);
    poolIds.push(old.id);
    expect((old.rules as { pick_deadline_rule: string }).pick_deadline_rule).toBe("first_kickoff_of_week");
    expect((await db.query.pools.findFirst({ where: eq(pools.id, created.id) }))!.rules).toMatchObject({ pick_deadline_rule: "per_game_kickoff" });
  });

  describe("Home and the pick sheet", () => {
    it("survivor with no pick still needs one, counting down to the next game", async () => {
      const s = await scene("survivor");
      const e = await summaryFor(s.me);
      expect(e.state).toBe("needs_picks");
      expect(Math.abs(Date.parse(e.lockTime!) - at(24).getTime())).toBeLessThan(5000);
    });

    it("survivor with a pick in an open game is picked, counting down to that game", async () => {
      const s = await scene("survivor");
      await createPick(s.mine.id, 1, "PHI");
      const e = await summaryFor(s.me);
      expect(e.state).toBe("picked");
      expect(Math.abs(Date.parse(e.lockTime!) - at(48).getTime())).toBeLessThan(5000);
    });

    it("survivor whose pick's game has started is locked", async () => {
      const s = await scene("survivor");
      await createPick(s.mine.id, 1, "KC");
      const e = await summaryFor(s.me);
      expect(e.state).toBe("locked");
      expect(e.lockTime).toBeNull();
    });

    it("the same entry in a whole-week pool is locked for the whole week once the first game starts", async () => {
      const s = await scene("survivor", "first_kickoff_of_week");
      expect((await summaryFor(s.me)).state).toBe("locked");
    });

    it("pick 'em needs a pick for every game that has not started", async () => {
      const s = await scene("pick_em");
      await createPick(s.mine.id, 1, "DET");
      expect((await summaryFor(s.me)).state).toBe("needs_picks");
      await createPick(s.mine.id, 1, "PHI");
      expect((await summaryFor(s.me)).state).toBe("picked");
    });

    it("the pick sheet marks each game and pick as locked or open, and says the rule", async () => {
      const s = await scene("survivor");
      await createPick(s.mine.id, 1, "KC");
      const sheet = await get<PickSheet>(s.me, `/entries/${s.mine.id}/pick-sheet`);
      expect(sheet.lockRule).toBe("game");
      expect(sheet.games.map((g) => [g.homeTeam, g.locked])).toEqual([["BUF", true], ["DET", false], ["PHI", false]]);
      expect(sheet.picks).toEqual([expect.objectContaining({ teamCode: "KC", locked: true })]);

      const whole = await scene("survivor", "first_kickoff_of_week");
      const wholeSheet = await get<PickSheet>(whole.me, `/entries/${whole.mine.id}/pick-sheet`);
      expect(wholeSheet.lockRule).toBe("week");
      expect(wholeSheet.games.every((g) => g.locked)).toBe(true);
    });
  });

  describe("who sees which pick", () => {
    it("another player sees only the picks whose game has started; an admin sees the rest as picked", async () => {
      const s = await scene("survivor");
      const admin = await person("Some Admin", true);
      // Two entries in one pool, each with a pick: one for a started game, one not.
      await createPick(s.theirs.id, 1, "KC");
      const mate = await person("Third");
      const third = await createEntry(s.pool.id, mate.id);
      await createPick(third.id, 1, "DET");

      const seen = await get<{ entryId: string; teamCode: string | null }[]>(s.me, `/pools/${s.pool.id}/picks`);
      expect(seen).toEqual([expect.objectContaining({ entryId: s.theirs.id, teamCode: "KC" })]);

      const adminSees = await get<{ entryId: string; teamCode: string | null; submitted?: boolean }[]>(admin, `/pools/${s.pool.id}/picks`);
      expect(adminSees.find((r) => r.entryId === third.id)).toMatchObject({ teamCode: null, submitted: true });
      expect(adminSees.find((r) => r.entryId === s.theirs.id)!.teamCode).toBe("KC");

      // The owner always sees their own open pick.
      const own = await get<{ teamCode: string }[]>(mate, `/entries/${third.id}/picks`);
      expect(own.map((p) => p.teamCode)).toEqual(["DET"]);
      // And another player does not see it through the entry route either.
      expect(await get(s.me, `/entries/${third.id}/picks`)).toEqual([]);
    });
  });

  describe("TV most picked", () => {
    it("counts only picks whose game has started, with shares among those", async () => {
      const s = await scene("survivor");
      await createPick(s.theirs.id, 1, "KC");
      const a = await createEntry(s.pool.id, (await person("A")).id);
      const b = await createEntry(s.pool.id, (await person("B")).id);
      await createPick(a.id, 1, "KC");
      await createPick(b.id, 1, "DET"); // not started: must not count
      const tv = await get<PoolTv>(s.me, `/pools/${s.pool.id}/tv`);
      expect(tv.pickDeadline).toBe("per_game_kickoff");
      expect(tv.mostPicked).toEqual([{ team: "KC", picks: 2, sharePercent: 100 }]);
    });

    it("shows nothing before any game has started", async () => {
      const s = await scene("survivor");
      for (const g of await db.query.games.findMany({ where: (t, { eq: e }) => e(t.seasonYear, s.season) })) {
        await db.update((await import("../db/schema.js")).games).set({ kickoffTime: at(30) }).where(eq((await import("../db/schema.js")).games.id, g.id));
      }
      await createPick(s.theirs.id, 1, "KC");
      expect((await get<PoolTv>(s.me, `/pools/${s.pool.id}/tv`)).mostPicked).toEqual([]);
    });
  });
});
