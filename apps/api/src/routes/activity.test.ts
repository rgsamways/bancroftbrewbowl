import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type ActivityPage } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, entries, pools, user as userTable, wipeoutEvents } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

// These tests cover what happens when the acting admin is the only admin (the change applies
// at once, recorded and flagged). The confirmation path is in admin-requests.test.ts.
vi.mock("../lib/admin-requests.js", async (original) => ({
  ...(await original<typeof import("../lib/admin-requests.js")>()),
  otherAdmins: async () => [],
}));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const future = (h: number) => new Date(Date.now() + h * HOUR);

describe("admin activity record", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2940;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    // Test records are removed by test code only; the app has no way to delete them.
    if (userIds.length > 0) await db.delete(adminActivity).where(inArray(adminActivity.actorId, userIds));
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const admin = (name = "Alex Admin") => person(name, true);
  const pool = async (type: "survivor" | "pick_em", season: number, rules: object = {}) => {
    const p =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, ...rules }, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, ...rules }, season);
    poolIds.push(p.id);
    return p;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date) => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    return g;
  };
  const records = (actor: User) =>
    db.select().from(adminActivity).where(eq(adminActivity.actorId, actor.id)).orderBy(desc(adminActivity.createdAt));
  const send = (method: "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, payload });

  describe("recording", () => {
    it("entering a result is recorded with who, what and when; changing it says changed", async () => {
      const season = nextSeason++;
      const alex = await admin();
      actAs(as(alex));
      const g = await game(season, 1, "KC", "BUF", future(-5));
      expect((await send("POST", `/nfl/games/${g.id}/result`, { result: "home_win" })).statusCode).toBe(200);
      let [r] = await records(alex);
      expect(r).toMatchObject({ kind: "result_entered", actorId: alex.id, actorName: "Alex Admin", affectsOwnEntry: false });
      expect(r!.summary).toBe("Alex Admin entered a result: Chiefs vs Bills, Chiefs won.");
      expect(Date.now() - r!.createdAt.getTime()).toBeLessThan(60_000);

      await send("POST", `/nfl/games/${g.id}/result`, { result: "away_win" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "result_changed" });
      expect(r!.summary).toBe("Alex Admin changed a result: Chiefs vs Bills, Bills won.");
    });

    it("a score update is recorded", async () => {
      const alex = await admin();
      actAs(as(alex));
      const g = await game(nextSeason++, 1, "KC", "BUF", future(-5));
      await send("PATCH", `/nfl/games/${g.id}/score`, { home_score: 27, away_score: 24 });
      const [r] = await records(alex);
      expect(r).toMatchObject({ kind: "score_updated" });
      expect(r!.summary).toContain("Chiefs vs Bills, 27–24");
    });

    it("a result that eliminates the acting admin's own entry is flagged; one that does not, is not", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const alex = await admin();
      const other = await person("Other Player");
      const mine = await createEntry(p.id, alex.id);
      const theirs = await createEntry(p.id, other.id);
      const g = await game(season, 1, "KC", "BUF", future(-5));
      await createPick(mine.id, 1, "KC"); // Alex picked the loser
      await createPick(theirs.id, 1, "BUF"); // someone else picked the winner, so no wipeout
      actAs(as(alex));
      await send("POST", `/nfl/games/${g.id}/result`, { result: "away_win" });
      const [r] = await records(alex);
      expect(r!.affectsOwnEntry).toBe(true);
      expect((await db.query.entries.findFirst({ where: eq(entries.id, mine.id) }))!.status).toBe("eliminated");

      // A different admin entering a result that only affects other people is not flagged.
      const season2 = nextSeason++;
      const p2 = await pool("survivor", season2);
      const other2 = await person("Loser Two");
      const winner = await person("Winner Two");
      const e1 = await createEntry(p2.id, other2.id);
      const e2 = await createEntry(p2.id, winner.id);
      const g2 = await game(season2, 1, "DAL", "PHI", future(-5));
      await createPick(e1.id, 1, "DAL");
      await createPick(e2.id, 1, "PHI");
      const sam = await admin("Sam Admin");
      actAs(as(sam));
      await send("POST", `/nfl/games/${g2.id}/result`, { result: "away_win" });
      expect((await records(sam))[0]!.affectsOwnEntry).toBe(false);
    });

    it("resolving a wipeout is recorded in the same step, flagged when the admin's own entry is involved", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const alex = await admin();
      const other = await person("Wipeout Other");
      const mine = await createEntry(p.id, alex.id);
      const theirs = await createEntry(p.id, other.id);
      const g = await game(season, 1, "KC", "BUF", future(-5));
      const [event] = await db
        .insert(wipeoutEvents)
        .values({ poolId: p.id, weekNumber: 1, gameId: g.id, candidateEntryIds: [mine.id, theirs.id] })
        .returning();
      actAs(as(alex));
      const res = await send("POST", `/pools/${p.id}/wipeouts/${event!.id}/resolve`, { surviving_entry_ids: [mine.id, theirs.id] });
      expect(res.statusCode).toBe(200);
      const [r] = await records(alex);
      expect(r).toMatchObject({ kind: "wipeout_resolved", poolId: p.id, affectsOwnEntry: true });
      expect(r!.summary).toBe(`Alex Admin kept 2 players alive after a wipeout in ${p.name}.`);

      // A refused resolve (already resolved) writes nothing more.
      const before = (await records(alex)).length;
      expect((await send("POST", `/pools/${p.id}/wipeouts/${event!.id}/resolve`, { surviving_entry_ids: [mine.id] })).statusCode).toBe(409);
      expect((await records(alex)).length).toBe(before);
    });

    it("a wipeout that does not involve the admin's own entry is not flagged", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const sam = await admin("Sam Admin");
      const a = await person("Cand A");
      const b = await person("Cand B");
      const ea = await createEntry(p.id, a.id);
      const eb = await createEntry(p.id, b.id);
      const g = await game(season, 1, "KC", "BUF", future(-5));
      const [event] = await db
        .insert(wipeoutEvents)
        .values({ poolId: p.id, weekNumber: 1, gameId: g.id, candidateEntryIds: [ea.id, eb.id] })
        .returning();
      actAs(as(sam));
      await send("POST", `/pools/${p.id}/wipeouts/${event!.id}/resolve`, { surviving_entry_ids: [ea.id] });
      const [r] = await records(sam);
      expect(r).toMatchObject({ kind: "wipeout_resolved", affectsOwnEntry: false });
      expect(r!.summary).toContain("kept 1 player alive");
    });

    it("editing a player's status and adding players are recorded; own entry is flagged, someone else's is not", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const alex = await admin();
      const other = await person("Status Other");
      const mine = await createEntry(p.id, alex.id);
      const theirs = await createEntry(p.id, other.id);
      actAs(as(alex));

      await send("PATCH", `/entries/${theirs.id}`, { status: "eliminated", eliminatedWeek: 2 });
      let [r] = await records(alex);
      expect(r).toMatchObject({ kind: "player_status_changed", poolId: p.id, affectsOwnEntry: false });
      expect(r!.summary).toBe(`Alex Admin set Status Other to eliminated in ${p.name}.`);

      await send("PATCH", `/entries/${mine.id}`, { status: "alive" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "player_status_changed", affectsOwnEntry: true });

      await send("PATCH", `/entries/${theirs.id}`, { eliminatedWeek: 3 });
      [r] = await records(alex);
      expect(r!.summary).toBe(`Alex Admin changed Status Other's elimination week in ${p.name}.`);

      // Adding a brand-new invited player, and adding an existing account (here, the admin).
      const invited = await send("POST", `/pools/${p.id}/entries`, { email: `new-${crypto.randomUUID()}@example.com`, display_name: "New Person" });
      expect(invited.statusCode).toBe(201);
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "player_added", affectsOwnEntry: false });
      expect(r!.summary).toBe(`Alex Admin added New Person to ${p.name}.`);

      const p2 = await pool("survivor", nextSeason++);
      await send("POST", `/pools/${p2.id}/entries`, { email: alex.email, display_name: "Alex Admin" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "player_added", poolId: p2.id, affectsOwnEntry: true });
    });

    it("pool changes are recorded, one record per kind of change", async () => {
      const alex = await admin();
      actAs(as(alex));
      const created = await send("POST", "/pools", { name: "Fall Classic ACT", season_year: 2098, type: "survivor" });
      expect(created.statusCode).toBe(201);
      const poolId = created.json().id as string;
      poolIds.push(poolId);
      let [r] = await records(alex);
      expect(r).toMatchObject({ kind: "pool_created", poolId });
      expect(r!.summary).toBe("Alex Admin created Fall Classic ACT (Survivor, 2098 season).");

      await send("PATCH", `/pools/${poolId}`, { status: "active" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "pool_locked" });
      expect(r!.summary).toBe("Alex Admin locked the rules of Fall Classic ACT.");

      await send("PATCH", `/pools/${poolId}`, { status: "draft" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "pool_unlocked" });

      const beforeTotal = (await records(alex)).length;
      await send("PATCH", `/pools/${poolId}`, { pool_total_cents: 32050 });
      let all = await records(alex);
      expect(all.length).toBe(beforeTotal + 1); // only the total, nothing else
      expect(all[0]).toMatchObject({ kind: "pool_total_changed" });
      expect(all[0]!.summary).toBe("Alex Admin set the pool total for Fall Classic ACT to $320.50.");
      await send("PATCH", `/pools/${poolId}`, { pool_total_cents: null });
      expect((await records(alex))[0]!.summary).toBe("Alex Admin cleared the pool total for Fall Classic ACT.");

      await send("PATCH", `/pools/${poolId}`, { name: "Fall Classic ACT 2" });
      expect((await records(alex))[0]).toMatchObject({ kind: "pool_settings_changed" });

      // Several changes in one request give several records.
      const count = (await records(alex)).length;
      await send("PATCH", `/pools/${poolId}`, { status: "active", pool_total_cents: 100 });
      all = await records(alex);
      expect(all.length).toBe(count + 2);
      expect(all.slice(0, 2).map((x) => x.kind).sort()).toEqual(["pool_locked", "pool_total_changed"]);

      // A change that changes nothing writes nothing.
      const same = (await records(alex)).length;
      await send("PATCH", `/pools/${poolId}`, { name: "Fall Classic ACT 2", pool_total_cents: 100 });
      expect((await records(alex)).length).toBe(same);
    });

    it("deleting a pool is recorded and the record outlives the pool, flagged when the admin plays in it", async () => {
      const alex = await admin();
      const p = await pool("survivor", nextSeason++);
      await createEntry(p.id, alex.id);
      actAs(as(alex));
      const res = await send("DELETE", `/pools/${p.id}`, { confirm_name: p.name });
      expect(res.statusCode).toBe(200);
      const [r] = await records(alex);
      expect(r).toMatchObject({ kind: "pool_deleted", poolId: null, affectsOwnEntry: true });
      expect(r!.summary).toBe(`Alex Admin deleted ${p.name}.`);
      expect(await db.query.pools.findFirst({ where: eq(pools.id, p.id) })).toBeUndefined();
    });

    it("a deleted account leaves its records, with the name it had", async () => {
      const temp = await admin("Temp Admin");
      actAs(as(temp));
      const res = await send("POST", "/pools", { name: "Temp Pool ACT", season_year: 2096, type: "pick_em" });
      poolIds.push(res.json().id);
      const [row] = await records(temp);
      expect(row!.actorName).toBe("Temp Admin");
      await db.delete(userTable).where(eq(userTable.id, temp.id));
      userIds.splice(userIds.indexOf(temp.id), 1);
      const survived = await db.query.adminActivity.findFirst({ where: eq(adminActivity.id, row!.id) });
      expect(survived).toMatchObject({ actorId: null, actorName: "Temp Admin" });
      await db.delete(adminActivity).where(eq(adminActivity.id, row!.id));
    });

    it("announcements and automatic offers are recorded", async () => {
      const alex = await admin();
      actAs(as(alex));
      const created = await send("POST", "/promotions", { season_year: 2097, week_number: 3, title: "Wing night", description: "Half price wings" });
      expect(created.statusCode).toBe(201);
      const id = created.json().id as string;
      let [r] = await records(alex);
      expect(r).toMatchObject({ kind: "promotion_created" });
      expect(r!.summary).toBe('Alex Admin added the announcement "Wing night" for week 3, 2097.');

      await send("PATCH", `/promotions/${id}`, { title: "Wing Night!" });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "promotion_updated" });
      expect(r!.summary).toBe('Alex Admin edited the announcement "Wing Night!".');

      await send("DELETE", `/promotions/${id}`);
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "promotion_deleted" });

      await send("PATCH", "/canned-promotions/survivor_sunday", { enabled: true });
      await send("PATCH", "/canned-promotions/survivor_sunday", { enabled: false });
      [r] = await records(alex);
      expect(r).toMatchObject({ kind: "canned_promotion_changed" });
      expect(r!.summary).toContain("turned the automatic offer");
      expect(r!.summary).toContain("off");
    });

    it("refused requests write nothing: a player, an invalid body, an unknown pool", async () => {
      const alex = await admin();
      const player = await person("Plain Player");
      const p = await pool("survivor", nextSeason++);

      actAs(as(player));
      expect((await send("PATCH", `/pools/${p.id}`, { pool_total_cents: 5 })).statusCode).toBe(403);
      expect((await send("POST", "/pools", { name: "Nope", season_year: 2095 })).statusCode).toBe(403);

      actAs(as(alex));
      expect((await send("PATCH", `/pools/${p.id}`, { pool_total_cents: -5 })).statusCode).toBe(400);
      expect((await send("PATCH", `/pools/${crypto.randomUUID()}`, { name: "Ghost" })).statusCode).toBe(404);

      expect(await records(alex)).toHaveLength(0);
      expect(await records(player)).toHaveLength(0);
    });
  });

  describe("reading", () => {
    const seed = async (actor: User, count: number, start = Date.now() - count * 1000, over: Partial<typeof adminActivity.$inferInsert> = {}) => {
      await db.insert(adminActivity).values(
        Array.from({ length: count }, (_, i) => ({
          actorId: actor.id,
          actorName: actor.name,
          kind: "result_entered",
          summary: `${actor.name} entered a result: #${i}.`,
          createdAt: new Date(start + i * 1000),
          ...over,
        }))
      );
    };
    const read = async (viewer: User | null, query = "") => {
      actAs(viewer ? as(viewer) : null);
      return app.inject({ method: "GET", url: `/admin/activity${query}` });
    };

    it("is for admins only", async () => {
      const player = await person("Reader Player");
      expect((await read(player)).statusCode).toBe(403);
      expect((await read(null)).statusCode).toBe(401);
    });

    it("lists newest first, 50 at a time, and pages back without gaps or repeats", async () => {
      const alex = await admin("Pager Admin");
      await seed(alex, 120);
      const first = (await read(alex)).json() as ActivityPage;
      const mine = (page: ActivityPage) => page.entries.filter((e) => e.actorId === alex.id);
      expect(first.entries).toHaveLength(50);
      expect(first.nextBefore).toBeTruthy();
      const times = first.entries.map((e) => Date.parse(e.createdAt));
      expect([...times].sort((a, b) => b - a)).toEqual(times);

      const second = (await read(alex, `?before=${encodeURIComponent(first.nextBefore!)}`)).json() as ActivityPage;
      expect(second.entries).toHaveLength(50);
      const third = (await read(alex, `?before=${encodeURIComponent(second.nextBefore!)}`)).json() as ActivityPage;
      const ours = [...mine(first), ...mine(second), ...mine(third)];
      expect(new Set(ours.map((e) => e.id)).size).toBe(ours.length); // no repeats
      expect(ours).toHaveLength(120); // no gaps
      expect(ours[0]!.summary).toContain("#119.");
    });

    it("rows written together (same timestamp) are not skipped across a page boundary", async () => {
      const alex = await admin("Tie Admin");
      const same = new Date();
      await seed(alex, 60, same.getTime(), { createdAt: same });
      const first = (await read(alex, "?filter=own")).json() as ActivityPage; // empty: none flagged
      expect(first.entries).toHaveLength(0);
      const a = (await read(alex)).json() as ActivityPage;
      const b = (await read(alex, `?before=${encodeURIComponent(a.nextBefore!)}`)).json() as ActivityPage;
      const ids = [...a.entries, ...b.entries].filter((e) => e.actorId === alex.id).map((e) => e.id);
      expect(new Set(ids).size).toBe(60);
    });

    it("filters: Standings, Your own entry (only the viewer's), and an empty Menu", async () => {
      const alex = await admin("Filter Admin");
      const sam = await admin("Filter Sam");
      await db.insert(adminActivity).values([
        { actorId: alex.id, actorName: alex.name, kind: "result_entered", summary: "A result.", createdAt: new Date(Date.now() - 5000) },
        { actorId: alex.id, actorName: alex.name, kind: "pool_locked", summary: "A lock.", createdAt: new Date(Date.now() - 4000) },
        { actorId: alex.id, actorName: alex.name, kind: "promotion_created", summary: "A promo.", createdAt: new Date(Date.now() - 3000) },
        { actorId: alex.id, actorName: alex.name, kind: "player_status_changed", summary: "Own status.", affectsOwnEntry: true, createdAt: new Date(Date.now() - 2000) },
        { actorId: sam.id, actorName: sam.name, kind: "player_status_changed", summary: "Sam own status.", affectsOwnEntry: true, createdAt: new Date(Date.now() - 1000) },
      ]);
      const summaries = async (viewer: User, filter: string) =>
        ((await read(viewer, `?filter=${filter}`)).json() as ActivityPage).entries
          .filter((e) => [alex.id, sam.id].includes(e.actorId!))
          .map((e) => e.summary);

      expect(await summaries(alex, "standings")).toEqual(["Sam own status.", "Own status.", "A lock.", "A result."]);
      expect(await summaries(alex, "own")).toEqual(["Own status."]); // not Sam's
      expect(await summaries(sam, "own")).toEqual(["Sam own status."]);
      expect(await summaries(alex, "everything")).toContain("A promo.");
      expect(((await read(alex, "?filter=menu")).json() as ActivityPage).entries).toEqual([]);
    });

    it("gives each entry a title from its kind", async () => {
      const alex = await admin("Title Admin");
      await seed(alex, 1);
      const page = (await read(alex)).json() as ActivityPage;
      expect(page.entries.find((e) => e.actorId === alex.id)!.title).toBe("Entered a result");
    });

    it("rejects a malformed cursor", async () => {
      const alex = await admin("Cursor Admin");
      expect((await read(alex, "?before=nonsense")).statusCode).toBe(400);
    });
  });

  describe("permanence", () => {
    it("has no way to edit or delete a record, even for an admin", async () => {
      const alex = await admin("Immutable Admin");
      const [row] = await db.insert(adminActivity).values({ actorId: alex.id, actorName: alex.name, kind: "result_entered", summary: "Keep me." }).returning();
      actAs(as(alex));
      for (const method of ["PATCH", "DELETE", "PUT"] as const) {
        expect((await app.inject({ method, url: `/admin/activity/${row!.id}`, payload: { summary: "Changed" } })).statusCode).toBe(404);
      }
      expect((await db.query.adminActivity.findFirst({ where: eq(adminActivity.id, row!.id) }))!.summary).toBe("Keep me.");
    });
  });
});
