import {
  defaultPickEmRulesConfig,
  defaultSurvivorRulesConfig,
  pickEmRulesConfigSchema,
  survivorRulesConfigSchema,
  type PoolTv,
} from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games, pools } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import { isRevealed } from "../lib/pick-lock.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("reveal_picks rule", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2920;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const user = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date, result?: "home_win") => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    if (result) await db.update(games).set({ result }).where(eq(games.id, g.id));
    return g;
  };
  const get = async <T>(viewer: User, url: string) => {
    actAs(as(viewer));
    const res = await app.inject({ method: "GET", url });
    return res.json() as T;
  };

  // One locked week with two games, one still undecided; "A" has picked KC.
  const scene = async (type: "survivor" | "pick_em", rule?: "at_lock" | "after_final_game") => {
    const season = nextSeason++;
    const p =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, ...(rule ? { reveal_picks: rule } : {}) }, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, ...(rule ? { reveal_picks: rule } : {}) }, season);
    poolIds.push(p.id);
    const decided = await game(season, 1, "KC", "BUF", at(-5), "home_win");
    const open = await game(season, 1, "DET", "NYJ", at(-4));
    const a = await user("Player A");
    const b = await user("Player B");
    const admin = await user("Some Admin", true);
    const aEntry = await createEntry(p.id, a.id);
    const bEntry = await createEntry(p.id, b.id);
    await createPick(aEntry.id, 1, "KC");
    return { season, pool: p, decided, open, a, b, admin, aEntry, bEntry };
  };

  type Row = { entryId: string; teamCode: string | null; submitted?: boolean };

  for (const type of ["survivor", "pick_em"] as const) {
    describe(type, () => {
      it("a pool without the rule shows picks once the week locks (today's behaviour)", async () => {
        const s = await scene(type);
        const rows = await get<Row[]>(s.b, `/pools/${s.pool.id}/picks`);
        expect(rows).toEqual([expect.objectContaining({ entryId: s.aEntry.id, teamCode: "KC" })]);
      });

      it("a pool saved before the rule existed behaves the same", async () => {
        const s = await scene(type);
        const { reveal_picks: _drop, ...old } = s.pool.rules as Record<string, unknown>;
        await db.update(pools).set({ rules: old as never }).where(eq(pools.id, s.pool.id));
        const rows = await get<Row[]>(s.b, `/pools/${s.pool.id}/picks`);
        expect(rows.map((r) => r.teamCode)).toEqual(["KC"]);
      });

      it("after_final_game: hidden from players, a marker for admins, always visible to the owner, until the last result", async () => {
        const s = await scene(type, "after_final_game");

        // Another player sees nothing of A's pick, on either route.
        expect(await get<Row[]>(s.b, `/pools/${s.pool.id}/picks`)).toEqual([]);
        expect(await get<Row[]>(s.b, `/entries/${s.aEntry.id}/picks`)).toEqual([]);

        // An admin sees only that A has picked.
        const adminRows = await get<Row[]>(s.admin, `/pools/${s.pool.id}/picks`);
        expect(adminRows).toEqual([expect.objectContaining({ entryId: s.aEntry.id, teamCode: null, submitted: true })]);

        // A sees their own pick in full.
        expect((await get<Row[]>(s.a, `/pools/${s.pool.id}/picks`)).map((r) => r.teamCode)).toEqual(["KC"]);

        // The last game gets its result: now everyone sees it.
        await db.update(games).set({ result: "away_win" }).where(eq(games.id, s.open.id));
        expect((await get<Row[]>(s.b, `/pools/${s.pool.id}/picks`)).map((r) => r.teamCode)).toEqual(["KC"]);
        expect((await get<Row[]>(s.b, `/entries/${s.aEntry.id}/picks`)).map((r) => r.teamCode)).toEqual(["KC"]);
      });

      it("after_final_game: a week that has not locked stays hidden even when nothing is pending", async () => {
        const s = await scene(type, "after_final_game");
        await db.update(games).set({ result: "home_win", kickoffTime: at(24) }).where(eq(games.id, s.open.id));
        await db.update(games).set({ kickoffTime: at(24) }).where(eq(games.id, s.decided.id));
        expect(await get<Row[]>(s.b, `/pools/${s.pool.id}/picks`)).toEqual([]);
      });
    });
  }

  it("TV most picked shows at the lock for the default rule, and says which rule applies", async () => {
    const s = await scene("survivor", "at_lock");
    const shown = await get<PoolTv>(s.b, `/pools/${s.pool.id}/tv`);
    expect(shown.revealPicks).toBe("at_lock");
    expect(shown.mostPicked).toEqual([{ team: "KC", picks: 1, sharePercent: 100 }]);
  });

  it("TV: the later rule holds most picked back while a game is undecided, even after the lock", async () => {
    const s = await scene("survivor", "after_final_game");
    const tv = await get<PoolTv>(s.b, `/pools/${s.pool.id}/tv`);
    expect(tv.revealPicks).toBe("after_final_game");
    expect(tv.mostPicked).toEqual([]);
  });

  it("saving the same rules on a locked pool saved before the rule existed is not a change", async () => {
    const s = await scene("survivor");
    const { reveal_picks: _drop, ...old } = s.pool.rules as Record<string, unknown>;
    await db.update(pools).set({ rules: old as never, status: "active" }).where(eq(pools.id, s.pool.id));
    actAs(as(s.admin));
    const res = await app.inject({ method: "PATCH", url: `/pools/${s.pool.id}`, payload: { rules: old } });
    expect(res.statusCode).toBe(200);
    // Actually changing the rule on a locked pool is refused.
    const changed = await app.inject({ method: "PATCH", url: `/pools/${s.pool.id}`, payload: { rules: { reveal_picks: "after_final_game" } } });
    expect(changed.statusCode).toBe(409);
  });

  it("the rules schemas default old rules to at_lock and reject unknown values", () => {
    const { reveal_picks: _a, ...oldSurvivor } = defaultSurvivorRulesConfig;
    const { reveal_picks: _b, ...oldPickEm } = defaultPickEmRulesConfig;
    expect(survivorRulesConfigSchema.parse(oldSurvivor).reveal_picks).toBe("at_lock");
    expect(pickEmRulesConfigSchema.parse(oldPickEm).reveal_picks).toBe("at_lock");
    expect(() => survivorRulesConfigSchema.parse({ ...oldSurvivor, reveal_picks: "never" })).toThrow();
  });

  it("isRevealed needs the lock, and for the later rule also no pending game", () => {
    const week = (lock: number, pending: number) => ({ lockTime: at(lock), gamesPending: pending });
    const now = new Date();
    expect(isRevealed(week(1, 0), "at_lock", now)).toBe(false);
    expect(isRevealed(week(-1, 3), "at_lock", now)).toBe(true);
    expect(isRevealed(week(-1, 3), "after_final_game", now)).toBe(false);
    expect(isRevealed(week(-1, 0), "after_final_game", now)).toBe(true);
    expect(isRevealed(week(1, 0), "after_final_game", now)).toBe(false);
  });
});
