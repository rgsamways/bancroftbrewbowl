import { defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { account, adminActivity, games, session as sessionTable, user as userTable } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import * as espn from "../lib/espn.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));
vi.mock("../lib/espn.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/espn.js")>()),
  fetchEspnWeek: vi.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User, over: Partial<TestActor & object> = {}): TestActor => ({
  id: u.id,
  name: u.name,
  email: u.email,
  isAdmin: u.isAdmin,
  emailVerified: true,
  ...over,
});
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("site setup (the god-user)", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2800;
  const fetchWeek = vi.mocked(espn.fetchEspnWeek);
  const savedEnv = process.env.OPERATOR_EMAILS;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.OPERATOR_EMAILS = savedEnv;
  });
  beforeEach(() => {
    fetchWeek.mockReset();
    fetchWeek.mockResolvedValue([]);
  });
  afterEach(async () => {
    if (userIds.length > 0) {
      await db.delete(adminActivity).where(inArray(adminActivity.actorId, userIds));
      await db.delete(sessionTable).where(inArray(sessionTable.userId, userIds));
    }
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  // The god-user: listed in OPERATOR_EMAILS, NOT flagged as an admin in the database.
  const god = async () => {
    const u = await person("The God User");
    process.env.OPERATOR_EMAILS = `someone-else@example.com, ${u.email.toUpperCase()}`;
    return u;
  };
  const call = async (who: User | null, method: "GET" | "POST" | "DELETE", url: string, payload?: object, over: Partial<TestActor & object> = {}) => {
    actAs(who ? as(who, over) : null);
    const res = await app.inject({ method, url, payload });
    return { status: res.statusCode, json: res.json() as Record<string, unknown> & { added?: number; moved?: unknown[]; totals?: object; weeks?: unknown; code?: string; alreadyAdmin?: boolean; hasPassword?: boolean }, body: res.body };
  };
  const records = async (u: User) => db.query.adminActivity.findMany({ where: eq(adminActivity.actorId, u.id) });

  describe("who may use it", () => {
    it("the god-user, and only the god-user, passes the setup routes; everyone else is refused", async () => {
      const g = await god();
      const lark = await person("Lark", true);
      const player = await person("Plain Player");
      for (const [method, url] of [["GET", "/operator/admins"], ["GET", "/operator/users?email=a@b.co"], ["GET", "/operator/schedule?season=2999"]] as const) {
        expect((await call(null, method, url)).status).toBe(401);
        expect((await call(player, method, url)).status).toBe(403);
        expect((await call(lark, method, url)).status).toBe(403); // an ordinary admin
      }
      expect((await call(g, "GET", "/operator/admins")).status).toBe(200);
    });

    it("an unverified email does not qualify, even when the address is listed", async () => {
      const g = await god();
      const res = await call(g, "GET", "/operator/admins", undefined, { emailVerified: false });
      expect(res.status).toBe(403);
    });

    it("with no OPERATOR_EMAILS nobody is the god-user", async () => {
      const g = await god();
      process.env.OPERATOR_EMAILS = "";
      expect((await call(g, "GET", "/operator/admins")).status).toBe(403);
    });

    it("the god-user passes ordinary admin checks without the admin flag", async () => {
      const g = await god();
      // The admin summary needs an admin.
      expect((await call(g, "GET", "/admin/summary")).status).toBe(200);
      const player = await person("Plain Player");
      expect((await call(player, "GET", "/admin/summary")).status).toBe(403);
    });

    it("the god-user is still bound by the fairness rules: no early look at picks, no changing anyone's pick", async () => {
      const g = await god();
      const season = nextSeason++;
      const pool = await createPool("survivor", { ...defaultSurvivorRulesConfig, pick_deadline_rule: "per_game_kickoff" }, season);
      poolIds.push(pool.id);
      const open = await createGame({ seasonYear: season, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: at(24) });
      gameIds.push(open.id);
      const other = await person("Other Player");
      const entry = await createEntry(pool.id, other.id);
      await createPick(entry.id, 1, "KC");

      // Sees only that a pick exists, never the team.
      const seen = await call(g, "GET", `/pools/${pool.id}/picks`);
      expect(seen.json).toEqual([expect.objectContaining({ entryId: entry.id, teamCode: null, submitted: true })]);
      // Cannot change or remove another player's pick.
      expect((await call(g, "POST", `/entries/${entry.id}/picks`, { week_number: 1, team_code: "BUF" })).status).toBe(403);
      expect((await call(g, "DELETE", `/entries/${entry.id}/picks/1/KC`)).status).toBe(403);
    });
  });

  describe("schedule", () => {
    const eg = (week: number, home: string, away: string, hours: number) =>
      ({ week, homeTeam: home, awayTeam: away, kickoff: at(hours), final: false, result: "pending", homeScore: null, awayScore: null }) as never;

    it("previews, then adds new games as undecided and moves unstarted kickoffs, never a started or decided game", async () => {
      const g = await god();
      const season = nextSeason++;
      const mk = async (week: number, home: string, away: string, hours: number, result?: "home_win") => {
        const game = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: at(hours) });
        gameIds.push(game.id);
        if (result) await db.update(games).set({ result }).where(eq(games.id, game.id));
        return game;
      };
      const flex = await mk(3, "KC", "BUF", 48);
      const started = await mk(3, "DET", "NYJ", -5);
      const decided = await mk(3, "PHI", "DAL", 30, "home_win");
      fetchWeek.mockImplementation(async (_y, week) =>
        week === 3
          ? [eg(3, "KC", "BUF", 53), eg(3, "DET", "NYJ", 100), eg(3, "PHI", "DAL", 90), eg(3, "SF", "SEA", 72)]
          : week === 1
            ? [eg(1, "MIA", "NE", 10)]
            : []
      );

      const preview = await call(g, "GET", `/operator/schedule?season=${season}`);
      expect(preview.status).toBe(200);
      expect(preview.json.totals).toMatchObject({ toAdd: 2, moved: 1 });
      expect(preview.json.weeks).toEqual([{ week: 1, toAdd: 1, moved: 0 }, { week: 3, toAdd: 1, moved: 1 }]);
      expect(await db.select().from(games).where(eq(games.seasonYear, season))).toHaveLength(3); // nothing written yet

      const applied = await call(g, "POST", "/operator/schedule", { season });
      expect(applied.status).toBe(200);
      expect(applied.json.added).toBe(2);
      expect(applied.json.moved).toHaveLength(1);
      const after = await db.select().from(games).where(eq(games.seasonYear, season));
      gameIds.push(...after.map((x) => x.id));
      expect(after).toHaveLength(5);
      expect(Math.abs(after.find((x) => x.id === flex.id)!.kickoffTime.getTime() - at(53).getTime())).toBeLessThan(2000);
      expect(Math.abs(after.find((x) => x.id === started.id)!.kickoffTime.getTime() - at(-5).getTime())).toBeLessThan(2000); // started: untouched
      const keptDecided = after.find((x) => x.id === decided.id)!;
      expect(keptDecided.result).toBe("home_win"); // never a result
      expect(Math.abs(keptDecided.kickoffTime.getTime() - at(30).getTime())).toBeLessThan(2000);
      expect(after.filter((x) => x.homeTeam === "SF" || x.homeTeam === "MIA").every((x) => x.result === "pending")).toBe(true);

      const rows = await records(g);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "schedule_loaded" });
      expect(rows[0]!.summary).toContain("2 games added");

      // Loading again changes nothing and writes no second record.
      const again = await call(g, "POST", "/operator/schedule", { season });
      expect(again.json.added).toBe(0);
      expect(await records(g)).toHaveLength(1);
    });

    it("says plainly when ESPN cannot be reached and changes nothing; rejects a bad season", async () => {
      const g = await god();
      fetchWeek.mockRejectedValue(new espn.EspnError("down"));
      expect((await call(g, "GET", "/operator/schedule?season=2990")).status).toBe(502);
      expect((await call(g, "POST", "/operator/schedule", { season: 2990 })).status).toBe(502);
      expect((await call(g, "GET", "/operator/schedule?season=1999")).status).toBe(400);
      expect((await call(g, "POST", "/operator/schedule", { season: "x" })).status).toBe(400);
      expect(await records(g)).toHaveLength(0);
    });
  });

  describe("admins", () => {
    it("adds an existing account as an admin, once, and records it", async () => {
      const g = await god();
      const lark = await person("Lark Admin Candidate");
      const res = await call(g, "POST", "/operator/admins", { email: lark.email.toUpperCase() });
      expect(res.status).toBe(201);
      expect((await db.query.user.findFirst({ where: eq(userTable.id, lark.id) }))!.isAdmin).toBe(true);
      expect((await records(g))[0]).toMatchObject({ kind: "admin_added" });
      const again = await call(g, "POST", "/operator/admins", { email: lark.email });
      expect(again.status).toBe(200);
      expect(again.json.alreadyAdmin).toBe(true);
      expect(await records(g)).toHaveLength(1);
      expect(((await call(g, "GET", "/operator/admins")).json as unknown as { id: string }[]).some((a) => a.id === lark.id)).toBe(true);
    });

    it("says they need to sign in first when there is no account, and rejects a bad email", async () => {
      const g = await god();
      const res = await call(g, "POST", "/operator/admins", { email: "nobody-here@example.com" });
      expect(res.status).toBe(404);
      expect(res.json.code).toBe("NO_ACCOUNT");
      expect((await call(g, "POST", "/operator/admins", { email: "not an email" })).status).toBe(400);
    });

    it("removes an admin, but never the last admin or the god-user's own account", async () => {
      const g = await god();
      // The local database can hold other admin accounts; make this test's the only ones, then put them back.
      const others = (await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.isAdmin, true))).map((r) => r.id);
      if (others.length > 0) await db.update(userTable).set({ isAdmin: false }).where(inArray(userTable.id, others));
      try {
        await removeAdminChecks(g);
      } finally {
        if (others.length > 0) await db.update(userTable).set({ isAdmin: true }).where(inArray(userTable.id, others));
      }
    });

    const removeAdminChecks = async (g: User) => {
      const lark = await person("Lark", true);
      // With the god-user not flagged, Lark is the only admin: cannot be removed.
      expect((await call(g, "DELETE", `/operator/admins/${lark.id}`)).status).toBe(409);
      const second = await person("Second Admin", true);
      expect((await call(g, "DELETE", `/operator/admins/${lark.id}`)).status).toBe(200);
      expect((await db.query.user.findFirst({ where: eq(userTable.id, lark.id) }))!.isAdmin).toBe(false);
      expect((await records(g)).map((r) => r.kind)).toEqual(["admin_removed"]);
      // The god-user's account, when it is flagged an admin as well, cannot be removed here.
      await db.update(userTable).set({ isAdmin: true }).where(eq(userTable.id, g.id));
      expect((await call(g, "DELETE", `/operator/admins/${g.id}`)).status).toBe(409);
      expect((await call(g, "DELETE", `/operator/admins/${lark.id}`)).status).toBe(404); // no longer an admin
      expect((await db.query.user.findFirst({ where: eq(userTable.id, second.id) }))!.isAdmin).toBe(true);
    };
  });

  describe("help someone sign in", () => {
    const withPasswordAndSession = async (u: User) => {
      await db.insert(account).values({ id: crypto.randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: "hash" });
      await db.insert(sessionTable).values({ id: crypto.randomUUID(), token: crypto.randomUUID(), userId: u.id, expiresAt: at(24) });
    };

    it("finds the player by email, then signs them out everywhere and removes their password", async () => {
      const g = await god();
      const locked = await person("Locked Out");
      await withPasswordAndSession(locked);

      const found = await call(g, "GET", `/operator/users?email=${encodeURIComponent(locked.email.toUpperCase())}`);
      expect(found.status).toBe(200);
      expect(found.json).toMatchObject({ id: locked.id, name: "Locked Out", hasPassword: true });
      expect(found.body).not.toContain("hash");

      const res = await call(g, "POST", `/operator/players/${locked.id}/sign-in-reset`);
      expect(res.status).toBe(200);
      expect(await db.select().from(sessionTable).where(eq(sessionTable.userId, locked.id))).toHaveLength(0);
      expect(await db.select().from(account).where(and(eq(account.userId, locked.id), eq(account.providerId, "credential")))).toHaveLength(0);
      expect((await call(g, "GET", `/operator/users?email=${encodeURIComponent(locked.email)}`)).json.hasPassword).toBe(false);
      expect((await records(g))[0]).toMatchObject({ kind: "sign_in_reset" });
    });

    it("refuses the god-user's own account, a missing account, and a bad email; others cannot use it", async () => {
      const g = await god();
      expect((await call(g, "POST", `/operator/players/${g.id}/sign-in-reset`)).status).toBe(400);
      expect((await call(g, "POST", `/operator/players/${crypto.randomUUID()}/sign-in-reset`)).status).toBe(404);
      expect((await call(g, "GET", "/operator/users?email=nobody@example.com")).status).toBe(404);
      expect((await call(g, "GET", "/operator/users?email=nope")).status).toBe(400);
      const lark = await person("Lark", true);
      const victim = await person("Victim");
      expect((await call(lark, "POST", `/operator/players/${victim.id}/sign-in-reset`)).status).toBe(403);
    });
  });
});
