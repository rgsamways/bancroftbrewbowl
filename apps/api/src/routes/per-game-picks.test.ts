import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games, picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("picks lock at each game's kickoff (per-game pools)", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2880;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string) => {
    const u = await createUser({ name });
    userIds.push(u.id);
    return u;
  };

  // Week 1: KC at BUF started two hours ago; DET-NYJ, PHI-DAL and SF-SEA are still to come.
  const scene = async (type: "survivor" | "pick_em", rule: "per_game_kickoff" | "first_kickoff_of_week", rules: object = {}) => {
    const season = nextSeason++;
    const base = type === "survivor" ? defaultSurvivorRulesConfig : defaultPickEmRulesConfig;
    const p =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, ...rules, pick_deadline_rule: rule }, season)
        : await createPool("pick_em", { ...base, ...rules, pick_deadline_rule: rule } as typeof defaultPickEmRulesConfig, season);
    poolIds.push(p.id);
    const game = async (home: string, away: string, hours: number) => {
      const g = await createGame({ seasonYear: season, weekNumber: 1, homeTeam: home, awayTeam: away, kickoffTime: at(hours) });
      gameIds.push(g.id);
      return g;
    };
    const started = await game("BUF", "KC", -2);
    const det = await game("DET", "NYJ", 24);
    await game("PHI", "DAL", 48);
    await game("SF", "SEA", 72);
    const me = await person("Pick Owner");
    const entry = await createEntry(p.id, me.id);
    return { season, pool: p, me, entry, started, det };
  };

  const post = async (me: User, entryId: string, team: string, week = 1) => {
    actAs(as(me));
    const res = await app.inject({ method: "POST", url: `/entries/${entryId}/picks`, payload: { week_number: week, team_code: team } });
    return { status: res.statusCode, json: res.json() as { teamCode?: string; error?: string } };
  };
  const remove = async (me: User, entryId: string, team: string, week = 1) => {
    actAs(as(me));
    return (await app.inject({ method: "DELETE", url: `/entries/${entryId}/picks/${week}/${team}` })).statusCode;
  };
  const myPicks = async (entryId: string) => (await db.query.picks.findMany({ where: eq(picks.entryId, entryId) })).map((p) => p.teamCode).sort();

  describe("survivor", () => {
    it("a later game can still be picked after the week's first game has started", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      expect((await post(s.me, s.entry.id, "DET")).status).toBe(201);
      expect(await myPicks(s.entry.id)).toEqual(["DET"]);
    });

    it("the same pick is refused in a whole-week pool once the first game has started", async () => {
      const s = await scene("survivor", "first_kickoff_of_week");
      const res = await post(s.me, s.entry.id, "DET");
      expect(res.status).toBe(409);
      expect(res.json.error).toContain("deadline");
      expect(await myPicks(s.entry.id)).toEqual([]);
    });

    it("a team whose game has started cannot be picked, from either side of the game", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      for (const team of ["KC", "BUF"]) {
        const res = await post(s.me, s.entry.id, team);
        expect(res.status).toBe(409);
        expect(res.json.error).toContain("started");
      }
      expect(await myPicks(s.entry.id)).toEqual([]);
    });

    it("changes a pick between two open games, and clears the old result", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      const first = await createPick(s.entry.id, 1, "DET");
      await db.update(picks).set({ result: "win" }).where(eq(picks.id, first.id));
      const res = await post(s.me, s.entry.id, "PHI");
      expect(res.status).toBe(200);
      expect(await myPicks(s.entry.id)).toEqual(["PHI"]);
      expect((await db.query.picks.findFirst({ where: eq(picks.entryId, s.entry.id) }))!.result).toBe("pending");
    });

    it("cannot leave a pick whose game has started, and cannot swap into one", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      await createPick(s.entry.id, 1, "KC");
      const out = await post(s.me, s.entry.id, "DET");
      expect(out.status).toBe(409);
      expect(await myPicks(s.entry.id)).toEqual(["KC"]);

      const t = await scene("survivor", "per_game_kickoff");
      await createPick(t.entry.id, 1, "DET");
      expect((await post(t.me, t.entry.id, "KC")).status).toBe(409);
      expect(await myPicks(t.entry.id)).toEqual(["DET"]);
    });

    it("removes a pick for an open game but not one whose game has started", async () => {
      const s = await scene("survivor", "per_game_kickoff", { double_pick_weeks: [1] });
      await createPick(s.entry.id, 1, "KC");
      await createPick(s.entry.id, 1, "DET");
      expect(await remove(s.me, s.entry.id, "KC")).toBe(409);
      expect(await remove(s.me, s.entry.id, "DET")).toBe(200);
      expect(await myPicks(s.entry.id)).toEqual(["KC"]);
    });

    it("a double-pick week takes one locked pick and one open pick, and refuses a third", async () => {
      const s = await scene("survivor", "per_game_kickoff", { double_pick_weeks: [1] });
      await createPick(s.entry.id, 1, "KC");
      expect((await post(s.me, s.entry.id, "PHI")).status).toBe(201);
      const full = await post(s.me, s.entry.id, "SF");
      expect(full.status).toBe(409);
      expect(await myPicks(s.entry.id)).toEqual(["KC", "PHI"]);
    });

    it("a game with a result stays locked even if its kickoff was moved later", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      await db.update(games).set({ result: "home_win" }).where(eq(games.id, s.det.id)); // decided, kickoff still 24h away
      const res = await post(s.me, s.entry.id, "DET");
      expect(res.status).toBe(409);
      expect(await myPicks(s.entry.id)).toEqual([]);
    });

    it("refuses a team on a bye (400) and a week with no games (404)", async () => {
      const s = await scene("survivor", "per_game_kickoff");
      expect((await post(s.me, s.entry.id, "MIA")).status).toBe(400);
      expect((await post(s.me, s.entry.id, "DET", 9)).status).toBe(404);
    });
  });

  describe("pick 'em", () => {
    it("one pick per game: picking the other team replaces it, and a started game is refused", async () => {
      const s = await scene("pick_em", "per_game_kickoff");
      expect((await post(s.me, s.entry.id, "DET")).status).toBe(201);
      const swap = await post(s.me, s.entry.id, "NYJ");
      expect(swap.status).toBe(200);
      expect(await myPicks(s.entry.id)).toEqual(["NYJ"]);
      expect((await post(s.me, s.entry.id, "PHI")).status).toBe(201);
      expect(await myPicks(s.entry.id)).toEqual(["NYJ", "PHI"]);
      expect((await post(s.me, s.entry.id, "KC")).status).toBe(409);
    });

    it("a pick for a started game cannot be removed or swapped", async () => {
      const s = await scene("pick_em", "per_game_kickoff");
      await createPick(s.entry.id, 1, "KC");
      expect(await remove(s.me, s.entry.id, "KC")).toBe(409);
      expect((await post(s.me, s.entry.id, "BUF")).status).toBe(409);
      expect(await myPicks(s.entry.id)).toEqual(["KC"]);
    });
  });
});
