import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type PickGrid } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games, picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, emailVerified: true });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("GET /pools/:id/pick-grid", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2840;

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
  const get = async (who: User | null, poolId: string) => {
    actAs(who ? as(who) : null);
    const res = await app.inject({ method: "GET", url: `/pools/${poolId}/pick-grid` });
    return { status: res.statusCode, body: res.body, json: res.json() as PickGrid };
  };

  /** Week 1: KC at BUF started two hours ago; DET at NYJ is tomorrow. */
  const scene = async (type: "survivor" | "pick_em", rules: object = {}) => {
    const season = nextSeason++;
    const pool =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, ...rules } as typeof defaultSurvivorRulesConfig, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, ...rules } as typeof defaultPickEmRulesConfig, season);
    poolIds.push(pool.id);
    const game = async (week: number, home: string, away: string, hours: number, result?: "home_win") => {
      const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: at(hours) });
      gameIds.push(g.id);
      if (result) await db.update(games).set({ result }).where(eq(games.id, g.id));
      return g;
    };
    const started = await game(1, "BUF", "KC", -2);
    await game(1, "DET", "NYJ", 24);
    const me = await person("Viewer Vic");
    const ann = await person("Ann Alive");
    const bob = await person("Bob Open");
    const mine = await createEntry(pool.id, me.id);
    const annEntry = await createEntry(pool.id, ann.id);
    const bobEntry = await createEntry(pool.id, bob.id);
    return { season, pool, game, started, me, ann, bob, mine, annEntry, bobEntry };
  };
  const cellTeams = (grid: PickGrid, name: string, col = 0) => {
    const cell = grid.rows.find((r) => r.name === name)!.cells[col]!;
    return cell.kind === "picks" ? cell.picks.map((p) => p.team) : cell.kind;
  };

  it("is for signed-in players, and 404 for no such pool", async () => {
    const s = await scene("survivor");
    expect((await get(null, s.pool.id)).status).toBe(401);
    expect((await get(s.me, crypto.randomUUID())).status).toBe(404);
  });

  it("per-game pool: a started game's pick shows, an unstarted one is blank, and my own always show", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "per_game_kickoff" });
    await createPick(s.annEntry.id, 1, "KC"); // started
    await createPick(s.bobEntry.id, 1, "DET"); // not started
    await createPick(s.mine.id, 1, "NYJ"); // mine, not started
    const { json, body } = await get(s.me, s.pool.id);
    expect(json.weeks).toEqual([1]);
    expect(cellTeams(json, "Ann Alive")).toEqual(["KC"]);
    expect(cellTeams(json, "Bob Open")).toBe("empty"); // an ordinary player sees nothing for it
    expect(cellTeams(json, "Viewer Vic")).toEqual(["NYJ"]);
    expect(body).not.toContain("DET");
  });

  it("an admin sees a marker, not the team, for a pick that is not revealed", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "per_game_kickoff" });
    await createPick(s.bobEntry.id, 1, "DET");
    const admin = await person("An Admin", true);
    const { json, body } = await get(admin, s.pool.id);
    expect(cellTeams(json, "Bob Open")).toBe("hidden");
    expect(body).not.toContain("DET");
  });

  it("whole-week pool: once the first game has started, everyone's picks for the week show", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "first_kickoff_of_week" });
    await createPick(s.bobEntry.id, 1, "DET");
    const { json } = await get(s.me, s.pool.id);
    expect(cellTeams(json, "Bob Open")).toEqual(["DET"]);
  });

  it("a pool that waits for the week's last game shows nothing of others until it is final, then everything", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "per_game_kickoff", reveal_picks: "after_final_game" });
    await createPick(s.annEntry.id, 1, "KC");
    await createPick(s.mine.id, 1, "NYJ");
    const early = await get(s.me, s.pool.id);
    expect(cellTeams(early.json, "Ann Alive")).toBe("empty");
    expect(cellTeams(early.json, "Viewer Vic")).toEqual(["NYJ"]); // my own, always

    for (const g of await db.query.games.findMany({ where: eq(games.seasonYear, s.season) })) {
      await db.update(games).set({ result: "home_win" }).where(eq(games.id, g.id));
    }
    const late = await get(s.me, s.pool.id);
    expect(cellTeams(late.json, "Ann Alive")).toEqual(["KC"]);
  });

  it("carries each pick's result, the most picked team, and the viewer's teams used", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "per_game_kickoff" });
    const kc = await createPick(s.annEntry.id, 1, "KC");
    await db.update(picks).set({ result: "win" }).where(eq(picks.id, kc.id));
    await createPick(s.bobEntry.id, 1, "KC");
    await createPick(s.mine.id, 1, "BUF");
    const { json } = await get(s.me, s.pool.id);
    const ann = json.rows.find((r) => r.name === "Ann Alive")!.cells[0]!;
    expect(ann).toEqual({ kind: "picks", picks: [{ team: "KC", result: "win" }] });
    expect(json.mostPicked[0]).toEqual({ team: "KC", sharePercent: 67 }); // KC: 2 of the 3 pickers shown
    expect(json.teamsUsed).toEqual({ used: 1, total: 32, repeatsAllowed: false });
  });

  it("leaves out weeks before anyone picked (a late start), and weeks after the current one", async () => {
    const s = await scene("survivor", { pick_deadline_rule: "per_game_kickoff" });
    // Weeks 2 to 4 played before the pool began (decided, no picks); week 5 is current with a pick; week 6 is ahead.
    for (const [week, home, away] of [[2, "KC", "BUF"], [3, "DET", "NYJ"], [4, "PHI", "DAL"]] as const) await s.game(week, home, away, -24 * (6 - week), "home_win");
    for (const g of await db.query.games.findMany({ where: eq(games.seasonYear, s.season) })) {
      if (g.weekNumber === 1) await db.update(games).set({ result: "home_win" }).where(eq(games.id, g.id));
    }
    await s.game(5, "SF", "SEA", 30);
    await s.game(6, "MIA", "NE", 200);
    await createPick(s.mine.id, 5, "SF");
    await createPick(s.annEntry.id, 6, "MIA"); // a pick in a week that is not current yet
    const { json } = await get(s.me, s.pool.id);
    expect(json.weeks).toEqual([5]);
  });

  it("a pool with no picks has no columns, and contains no email addresses", async () => {
    const s = await scene("survivor");
    const { json, body } = await get(s.me, s.pool.id);
    expect(json.weeks).toEqual([]);
    expect(json.rows).toHaveLength(3);
    expect(body).not.toContain("@");
  });

  it("pick 'em: points per week among the picks shown, a total and a shared rank", async () => {
    const s = await scene("pick_em", { pick_deadline_rule: "per_game_kickoff" });
    const a = await createPick(s.annEntry.id, 1, "KC");
    await db.update(picks).set({ result: "win" }).where(eq(picks.id, a.id));
    const b = await createPick(s.bobEntry.id, 1, "BUF");
    await db.update(picks).set({ result: "loss" }).where(eq(picks.id, b.id));
    await createPick(s.bobEntry.id, 1, "DET"); // not started: not shown to others
    const { json } = await get(s.me, s.pool.id);
    expect(json.rows[0]!.name).toBe("Viewer Vic"); // pinned first
    const ann = json.rows.find((r) => r.name === "Ann Alive")!;
    expect(ann.cells[0]).toEqual({ kind: "points", correct: 1, of: 2 });
    expect([ann.total, ann.rank]).toEqual([1, 1]);
    expect(json.rows.find((r) => r.name === "Bob Open")!.total).toBe(0);
    expect(json.teamsUsed).toBeNull();
  });
});
