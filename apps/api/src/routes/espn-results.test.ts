import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, entries, games, picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import * as espn from "../lib/espn.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));
vi.mock("../lib/espn.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/espn.js")>()),
  fetchEspnWeek: vi.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
type EspnGame = import("../lib/espn.js").EspnGame;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

const final = (home: string, away: string, result: "home_win" | "away_win" | "tie", homeScore: number, awayScore: number): EspnGame => ({
  week: 1,
  homeTeam: home as never,
  awayTeam: away as never,
  kickoff: new Date(),
  final: true,
  result,
  homeScore,
  awayScore,
});
const live = (home: string, away: string): EspnGame => ({ ...final(home, away, "home_win", 0, 0), final: false, result: "pending", homeScore: null, awayScore: null });

describe("Check for results (ESPN)", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2900;
  const fetchWeek = vi.mocked(espn.fetchEspnWeek);

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    fetchWeek.mockReset();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date, result?: "home_win" | "away_win") => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    if (result) await db.update(games).set({ result }).where(eq(games.id, g.id));
    return g;
  };
  const call = async (user: User | null, method: "GET" | "POST", url: string, payload?: object) => {
    actAs(user ? as(user) : null);
    const res = await app.inject({ method, url, payload });
    return { status: res.statusCode, json: res.json() as Record<string, unknown> & { applied?: unknown; skipped?: { reason: string }[]; wipeout?: boolean; finished?: unknown; differs?: unknown; seasonYear?: number; error?: string } };
  };
  const gameRow = async (id: string) => (await db.query.games.findFirst({ where: eq(games.id, id) }))!;
  const records = async (user: User) => db.query.adminActivity.findMany({ where: eq(adminActivity.actorId, user.id) });

  // Week 1 has kicked off. A, B undecided here; C decided by hand; D decided and agreeing. Week 2 is in the future.
  const scene = async () => {
    const season = nextSeason++;
    const admin = await person("Espn Admin", true);
    const a = await game(season, 1, "KC", "BUF", at(-30));
    const b = await game(season, 1, "DET", "NYJ", at(-29));
    const c = await game(season, 1, "PHI", "DAL", at(-28), "home_win");
    const d = await game(season, 1, "MIA", "NE", at(-27), "home_win");
    await game(season, 2, "KC", "DET", at(48));
    fetchWeek.mockImplementation(async (_year, week) =>
      week === 1
        ? [final("KC", "BUF", "home_win", 27, 24), live("DET", "NYJ"), final("PHI", "DAL", "away_win", 10, 20), final("MIA", "NE", "home_win", 17, 3)]
        : []
    );
    return { season, admin, a, b, c, d };
  };

  it("is for admins only", async () => {
    const s = await scene();
    const player = await person("Plain Player");
    for (const [method, url, payload] of [
      ["GET", "/admin/results/espn", undefined],
      ["POST", "/admin/results/espn/apply", { gameIds: [s.a.id] }],
    ] as const) {
      expect((await call(null, method, url, payload)).status).toBe(401);
      expect((await call(player, method, url, payload)).status).toBe(403);
    }
    expect(fetchWeek).not.toHaveBeenCalled();
    expect((await gameRow(s.a.id)).result).toBe("pending");
  });

  it("previews finished games, reports a difference, asks about the current week and the next two, and writes nothing", async () => {
    const s = await scene();
    const { status, json } = await call(s.admin, "GET", "/admin/results/espn");
    expect(status).toBe(200);
    expect(json.seasonYear).toBe(s.season);
    expect(json.finished).toEqual([expect.objectContaining({ gameId: s.a.id, week: 1, result: "home_win", homeScore: 27, awayScore: 24 })]);
    expect(json.differs).toEqual([expect.objectContaining({ gameId: s.c.id, enteredResult: "home_win", espnResult: "away_win" })]);
    expect(fetchWeek.mock.calls.map((c) => c[1])).toEqual([1, 2]); // the current week and the next one with games
    expect(json.moved).toEqual([]);
    expect((await gameRow(s.a.id)).result).toBe("pending");
    expect((await gameRow(s.c.id)).result).toBe("home_win");
    expect(await records(s.admin)).toHaveLength(0);
  });

  it("applies finished games like a hand-entered result: saved with scores, scored, eliminations follow, one record", async () => {
    const s = await scene();
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, s.season);
    poolIds.push(pool.id);
    const loser = await person("Picked Buffalo");
    const winner = await person("Picked Kansas City");
    const loserEntry = await createEntry(pool.id, loser.id);
    const winnerEntry = await createEntry(pool.id, winner.id);
    await createPick(loserEntry.id, 1, "BUF");
    await createPick(winnerEntry.id, 1, "KC");

    const { status, json } = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect(status).toBe(200);
    expect(json.applied).toEqual([expect.objectContaining({ gameId: s.a.id, result: "home_win" })]);
    expect(json.skipped).toEqual([]);

    const saved = await gameRow(s.a.id);
    expect(saved).toMatchObject({ result: "home_win", homeScore: 27, awayScore: 24, enteredBy: s.admin.id });
    expect((await db.query.entries.findFirst({ where: eq(entries.id, loserEntry.id) }))).toMatchObject({ status: "eliminated", eliminatedWeek: 1 });
    expect((await db.query.entries.findFirst({ where: eq(entries.id, winnerEntry.id) }))!.status).toBe("alive");
    expect((await db.query.picks.findFirst({ where: eq(picks.entryId, winnerEntry.id) }))!.result).toBe("win");

    const rows = await records(s.admin);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "results_imported", affectsOwnEntry: false });
    expect(rows[0]!.summary).toContain("imported 1 result from ESPN");
  });

  it("scores pick 'em pools too", async () => {
    const s = await scene();
    const pool = await createPool("pick_em", defaultPickEmRulesConfig, s.season);
    poolIds.push(pool.id);
    const player = await person("Pickem Player");
    const entry = await createEntry(pool.id, player.id);
    await createPick(entry.id, 1, "KC");
    await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect((await db.query.picks.findFirst({ where: eq(picks.entryId, entry.id) }))!.result).toBe("win");
  });

  it("holds a wipeout instead of eliminating everyone, and says so", async () => {
    const s = await scene();
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, s.season);
    poolIds.push(pool.id);
    const only = await person("Only Player");
    const entry = await createEntry(pool.id, only.id);
    await createPick(entry.id, 1, "BUF");
    const { json } = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect(json.wipeout).toBe(true);
    expect((await db.query.entries.findFirst({ where: eq(entries.id, entry.id) }))!.status).toBe("alive");
  });

  it("flags a record that touches the admin's own entry", async () => {
    const s = await scene();
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, s.season);
    poolIds.push(pool.id);
    const other = await person("Other Player");
    const mine = await createEntry(pool.id, s.admin.id);
    const theirs = await createEntry(pool.id, other.id);
    await createPick(mine.id, 1, "BUF");
    await createPick(theirs.id, 1, "KC");
    await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect((await records(s.admin))[0]).toMatchObject({ kind: "results_imported", affectsOwnEntry: true });
  });

  it("never overwrites a decided game, skips what is not final, and ignores a result sent by the browser", async () => {
    const s = await scene();
    const { json } = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.c.id, s.b.id, crypto.randomUUID()] });
    expect(json.applied).toEqual([]);
    expect(json.skipped!.map((x) => x.reason).sort()).toEqual(["already_decided", "not_final_on_espn", "not_found"]);
    expect((await gameRow(s.c.id)).result).toBe("home_win"); // ESPN said away_win; the hand-entered result stands
    expect((await gameRow(s.b.id)).result).toBe("pending");
    expect(await records(s.admin)).toHaveLength(0); // nothing changed, so no record

    const forged = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id], result: "away_win" });
    expect(forged.status).toBe(400);
    expect((await gameRow(s.a.id)).result).toBe("pending");
  });

  it("applying twice changes nothing the second time", async () => {
    const s = await scene();
    await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    const again = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect(again.json.applied).toEqual([]);
    expect(again.json.skipped).toEqual([{ gameId: s.a.id, reason: "already_decided" }]);
    expect(await records(s.admin)).toHaveLength(1);
  });

  it("says plainly when ESPN cannot be reached, and changes nothing", async () => {
    const s = await scene();
    fetchWeek.mockRejectedValue(new espn.EspnError("ESPN did not answer in time."));
    const preview = await call(s.admin, "GET", "/admin/results/espn");
    expect(preview.status).toBe(502);
    expect(preview.json.error).toContain("enter results by hand");
    const apply = await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id] });
    expect(apply.status).toBe(502);
    expect((await gameRow(s.a.id)).result).toBe("pending");
    expect(await records(s.admin)).toHaveLength(0);
  });

  describe("moved kickoffs (the NFL flexed a game)", () => {
    const kickoff = (g: EspnGame, hours: number): EspnGame => ({ ...g, kickoff: at(hours) });

    it("lists a game ESPN has moved, for the next two weeks too, never one that has started, and writes nothing", async () => {
      const s = await scene();
      // Week 2's KC at DET is stored +48h; ESPN now says +72h (flexed). Week 6 and week 7 also exist.
      const w2 = (await db.query.games.findMany({ where: eq(games.seasonYear, s.season) })).find((g) => g.weekNumber === 2)!;
      await game(s.season, 6, "SEA", "SF", at(24 * 33));
      await game(s.season, 7, "LAR", "ARI", at(24 * 40));
      fetchWeek.mockImplementation(async (_y, week) => {
        if (week === 1) return [kickoff(final("KC", "BUF", "home_win", 27, 24), -30), kickoff(live("DET", "NYJ"), 5)]; // DET: stored -29h, ESPN +5h but it has a result? no, it is pending and started: left alone
        if (week === 2) return [kickoff(live("KC", "DET"), 72)];
        if (week === 6) return [kickoff(live("SEA", "SF"), 24 * 33 + 5)];
        return [kickoff(live("LAR", "ARI"), 24 * 40 + 5)];
      });
      const { json } = await call(s.admin, "GET", "/admin/results/espn");
      const moved = (json.moved ?? []) as { gameId: string; week: number; from: string; to: string }[];
      expect(moved.map((m) => m.week).sort()).toEqual([2, 6]);
      expect(moved.find((m) => m.week === 2)).toMatchObject({ gameId: w2.id });
      expect(Math.abs(Date.parse(moved.find((m) => m.week === 2)!.to) - at(72).getTime())).toBeLessThan(2000);
      expect(fetchWeek.mock.calls.map((c) => c[1])).not.toContain(7); // beyond the next two weeks
      expect((await db.query.games.findFirst({ where: eq(games.id, w2.id) }))!.kickoffTime.getTime()).toBeLessThan(at(49).getTime()); // not written
      expect(await records(s.admin)).toHaveLength(0);
    });

    it("ignores differences of a minute or less", async () => {
      const s = await scene();
      fetchWeek.mockImplementation(async (_y, week) => (week === 2 ? [kickoff(live("KC", "DET"), 48 + 0.01)] : []));
      expect(((await call(s.admin, "GET", "/admin/results/espn")).json.moved as unknown[])).toEqual([]);
    });

    it("applies a moved kickoff, records it, and never moves a game that has started", async () => {
      const s = await scene();
      const w2 = (await db.query.games.findMany({ where: eq(games.seasonYear, s.season) })).find((g) => g.weekNumber === 2)!;
      fetchWeek.mockImplementation(async (_y, week) =>
        week === 2 ? [kickoff(live("KC", "DET"), 72)] : week === 1 ? [live("DET", "NYJ")] : []
      );
      const res = await call(s.admin, "POST", "/admin/results/espn/apply", { movedIds: [w2.id, s.b.id] });
      expect(res.status).toBe(200);
      const body = res.json as unknown as { moved: { gameId: string }[]; movedSkipped: { gameId: string }[] };
      expect(body.moved.map((m) => m.gameId)).toEqual([w2.id]);
      expect(body.movedSkipped.map((m) => m.gameId)).toEqual([s.b.id]); // week 1's DET game started 29 hours ago
      expect(Math.abs((await gameRow(w2.id)).kickoffTime.getTime() - at(72).getTime())).toBeLessThan(2000);
      const rows = await records(s.admin);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "schedule_updated" });
      expect(rows[0]!.summary).toContain("moved 1 kickoff");
    });

    it("one apply can save results and move kickoffs, with a single record", async () => {
      const s = await scene();
      const w2 = (await db.query.games.findMany({ where: eq(games.seasonYear, s.season) })).find((g) => g.weekNumber === 2)!;
      fetchWeek.mockImplementation(async (_y, week) =>
        week === 2
          ? [kickoff(live("KC", "DET"), 72)]
          : week === 1
            ? [final("KC", "BUF", "home_win", 27, 24), live("DET", "NYJ"), final("PHI", "DAL", "away_win", 10, 20), final("MIA", "NE", "home_win", 17, 3)]
            : []
      );
      await call(s.admin, "POST", "/admin/results/espn/apply", { gameIds: [s.a.id], movedIds: [w2.id] });
      expect((await gameRow(s.a.id)).result).toBe("home_win");
      const rows = await records(s.admin);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "results_imported" });
      expect(rows[0]!.summary).toContain("and moved 1 kickoff");
    });

    it("refuses an apply with nothing in it", async () => {
      const s = await scene();
      expect((await call(s.admin, "POST", "/admin/results/espn/apply", {})).status).toBe(400);
    });
  });
});
