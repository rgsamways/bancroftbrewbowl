import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { picks } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";
import { resolveEntry, WITH_EMAIL } from "./entries.js";

// Only "who is signed in" is replaced. Everything else is the real route code and
// the real test database. See ../test/route-harness.ts.
vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

const SEASON = 2999; // the fixtures' default season, which no real data uses
const HOUR = 60 * 60 * 1000;

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

describe("pick access", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];

  // A fresh world for every test: a pool with two players, an admin, one week that
  // has not locked yet (week 1) and one that already has (week 2).
  let alice: User;
  let bob: User;
  let admin: User;
  let poolId: string;
  let aliceEntryId: string;
  let bobEntryId: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    alice = await createUser({ name: "Alice" });
    bob = await createUser({ name: "Bob" });
    admin = await createUser({ name: "Admin", isAdmin: true });
    userIds.push(alice.id, bob.id, admin.id);

    const pool = await createPool("survivor", defaultSurvivorRulesConfig, SEASON);
    poolId = pool.id;
    poolIds.push(poolId);
    aliceEntryId = (await createEntry(poolId, alice.id)).id;
    bobEntryId = (await createEntry(poolId, bob.id)).id;

    const future = new Date(Date.now() + 48 * HOUR);
    const past = new Date(Date.now() - 48 * HOUR);
    gameIds.push(
      (await createGame({ seasonYear: SEASON, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: future })).id,
      (await createGame({ seasonYear: SEASON, weekNumber: 2, homeTeam: "PHI", awayTeam: "DAL", kickoffTime: past })).id
    );

    await createPick(aliceEntryId, 1, "KC"); // week 1 has not locked
    await createPick(aliceEntryId, 2, "PHI"); // week 2 has locked
  });

  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  // ---------------------------------------------------------------------------
  // Task 1.1: the harness itself works end to end.
  // ---------------------------------------------------------------------------
  describe("the test harness", () => {
    it("treats a request with no session as signed out", async () => {
      actAs(null);
      const res = await app.inject({ method: "GET", url: `/pools/${poolId}/picks` });
      expect(res.statusCode).toBe(401);
    });

    it("lets a signed-in request through to the real route and database", async () => {
      actAs(as(alice));
      const res = await app.inject({ method: "GET", url: `/pools/${poolId}/picks` });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 1.2: the behaviour the spec asks for. These were written first and fail
  // against the code as it was, which proves they catch the holes.
  // ---------------------------------------------------------------------------
  describe("reading picks before the week locks", () => {
    it("hides another player's pick from the entry endpoint", async () => {
      actAs(as(bob));
      const res = await app.inject({ method: "GET", url: `/entries/${aliceEntryId}/picks` });
      expect(res.statusCode).toBe(200);
      const unlockedWeek = (res.json() as { weekNumber: number }[]).filter((p) => p.weekNumber === 1);
      expect(unlockedWeek).toEqual([]);
    });

    it("hides another player's pick from the pool endpoint", async () => {
      actAs(as(bob));
      const res = await app.inject({ method: "GET", url: `/pools/${poolId}/picks` });
      expect(res.statusCode).toBe(200);
      const rows = res.json() as { entryId: string; weekNumber: number }[];
      expect(rows.filter((r) => r.entryId === aliceEntryId && r.weekNumber === 1)).toEqual([]);
    });
  });

  describe("reading picks, the whole picture", () => {
    type Row = { entryId: string; weekNumber: number; teamCode: string | null; result?: string | null; submitted?: true };
    const poolRows = async () => (await app.inject({ method: "GET", url: `/pools/${poolId}/picks` })).json() as Row[];
    const entryRows = async (entryId: string) => (await app.inject({ method: "GET", url: `/entries/${entryId}/picks` })).json() as Row[];

    it("shows another player's pick once the week has locked, on both endpoints", async () => {
      actAs(as(bob));
      const viaPool = (await poolRows()).filter((r) => r.entryId === aliceEntryId);
      const viaEntry = await entryRows(aliceEntryId);
      expect(viaPool).toEqual([expect.objectContaining({ weekNumber: 2, teamCode: "PHI" })]);
      expect(viaEntry).toEqual([expect.objectContaining({ weekNumber: 2, teamCode: "PHI" })]);
    });

    it("always shows a player their own picks, locked or not", async () => {
      actAs(as(alice));
      const viaPool = (await poolRows()).filter((r) => r.entryId === aliceEntryId);
      expect(viaPool.map((r) => `${r.weekNumber}:${r.teamCode}`).sort()).toEqual(["1:KC", "2:PHI"]);
      expect((await entryRows(aliceEntryId)).map((r) => r.weekNumber).sort()).toEqual([1, 2]);
    });

    it("gives an admin a marker with no team for another player's unlocked pick, and the full pick once locked", async () => {
      actAs(as(admin));
      for (const rows of [(await poolRows()).filter((r) => r.entryId === aliceEntryId), await entryRows(aliceEntryId)]) {
        const unlocked = rows.find((r) => r.weekNumber === 1);
        const lockedRow = rows.find((r) => r.weekNumber === 2);
        expect(unlocked).toEqual({ entryId: aliceEntryId, weekNumber: 1, teamCode: null, result: null, submitted: true });
        expect(JSON.stringify(unlocked)).not.toContain("KC");
        expect(lockedRow).toMatchObject({ weekNumber: 2, teamCode: "PHI" });
      }
    });

    it("lets an admin who also plays see their own pick in full but only a marker for everyone else's", async () => {
      const adminEntry = await createEntry(poolId, admin.id);
      await createPick(adminEntry.id, 1, "DAL");
      actAs(as(admin));
      const rows = await poolRows();
      expect(rows.find((r) => r.entryId === adminEntry.id && r.weekNumber === 1)).toMatchObject({ teamCode: "DAL" });
      expect(rows.find((r) => r.entryId === aliceEntryId && r.weekNumber === 1)).toMatchObject({ teamCode: null, submitted: true });
    });

    it("hides an unclaimed entry's unlocked pick from an ordinary player", async () => {
      const unclaimed = await createEntry(poolId);
      await createPick(unclaimed.id, 1, "MIA");
      actAs(as(bob));
      expect((await poolRows()).filter((r) => r.entryId === unclaimed.id)).toEqual([]);
    });

    it("answers 401 for both reads when nobody is signed in", async () => {
      actAs(null);
      expect((await app.inject({ method: "GET", url: `/pools/${poolId}/picks` })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: `/entries/${aliceEntryId}/picks` })).statusCode).toBe(401);
    });
  });

  describe("changing someone else's pick", () => {
    it("refuses to let another player change a pick", async () => {
      actAs(as(bob));
      const res = await app.inject({
        method: "POST",
        url: `/entries/${aliceEntryId}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      expect(res.statusCode).toBe(403);
      const [stored] = await db.select().from(picks).where(and(eq(picks.entryId, aliceEntryId), eq(picks.weekNumber, 1)));
      expect(stored?.teamCode).toBe("KC");
    });

    it("refuses to let another player delete a pick", async () => {
      actAs(as(bob));
      const res = await app.inject({ method: "DELETE", url: `/entries/${aliceEntryId}/picks/1/KC` });
      expect(res.statusCode).toBe(403);
      const stored = await db.select().from(picks).where(and(eq(picks.entryId, aliceEntryId), eq(picks.weekNumber, 1)));
      expect(stored).toHaveLength(1);
    });
  });

  describe("who may change a pick, in every other case", () => {
    it("refuses an admin who tries to change another player's pick", async () => {
      actAs(as(admin));
      const res = await app.inject({
        method: "POST",
        url: `/entries/${aliceEntryId}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "You can only change your own picks." });
      const [stored] = await db.select().from(picks).where(and(eq(picks.entryId, aliceEntryId), eq(picks.weekNumber, 1)));
      expect(stored?.teamCode).toBe("KC");
    });

    it("refuses an admin who tries to delete another player's pick", async () => {
      actAs(as(admin));
      const res = await app.inject({ method: "DELETE", url: `/entries/${aliceEntryId}/picks/1/KC` });
      expect(res.statusCode).toBe(403);
      const stored = await db.select().from(picks).where(and(eq(picks.entryId, aliceEntryId), eq(picks.weekNumber, 1)));
      expect(stored).toHaveLength(1);
    });

    it("refuses a pick on an entry nobody has claimed yet", async () => {
      const unclaimed = await createEntry(poolId); // an invite: no owner
      actAs(as(admin));
      const asAdmin = await app.inject({
        method: "POST",
        url: `/entries/${unclaimed.id}/picks`,
        payload: { week_number: 1, team_code: "KC" },
      });
      expect(asAdmin.statusCode).toBe(403);

      actAs(as(bob));
      const asPlayer = await app.inject({
        method: "POST",
        url: `/entries/${unclaimed.id}/picks`,
        payload: { week_number: 1, team_code: "KC" },
      });
      expect(asPlayer.statusCode).toBe(403);
      expect(await db.select().from(picks).where(eq(picks.entryId, unclaimed.id))).toHaveLength(0);
    });

    it("answers 401 when nobody is signed in", async () => {
      actAs(null);
      const post = await app.inject({
        method: "POST",
        url: `/entries/${aliceEntryId}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      const del = await app.inject({ method: "DELETE", url: `/entries/${aliceEntryId}/picks/1/KC` });
      expect(post.statusCode).toBe(401);
      expect(del.statusCode).toBe(401);
    });

    it("answers 404 for an entry that does not exist", async () => {
      actAs(as(alice));
      const res = await app.inject({
        method: "POST",
        url: `/entries/${crypto.randomUUID()}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("still enforces the deadline for the owner after the week's first kickoff", async () => {
      actAs(as(alice));
      const change = await app.inject({
        method: "POST",
        url: `/entries/${aliceEntryId}/picks`,
        payload: { week_number: 2, team_code: "DAL" },
      });
      expect(change.statusCode).toBe(409);
      expect(change.json()).toEqual({ error: "Pick deadline has passed" });

      const remove = await app.inject({ method: "DELETE", url: `/entries/${aliceEntryId}/picks/2/PHI` });
      expect(remove.statusCode).toBe(409);
      expect(remove.json()).toEqual({ error: "Pick deadline has passed" });
    });
  });

  describe("the owner of an entry", () => {
    it("can still change their own pick before the lock", async () => {
      actAs(as(alice));
      const res = await app.inject({
        method: "POST",
        url: `/entries/${aliceEntryId}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      expect(res.statusCode).toBe(200);
      const [stored] = await db.select().from(picks).where(and(eq(picks.entryId, aliceEntryId), eq(picks.weekNumber, 1)));
      expect(stored?.teamCode).toBe("BUF");
    });

    it("can still make a first pick and delete it before the lock", async () => {
      actAs(as(bob));
      const made = await app.inject({
        method: "POST",
        url: `/entries/${bobEntryId}/picks`,
        payload: { week_number: 1, team_code: "KC" },
      });
      expect(made.statusCode).toBe(201);

      const removed = await app.inject({ method: "DELETE", url: `/entries/${bobEntryId}/picks/1/KC` });
      expect(removed.statusCode).toBe(200);
      const left = await db.select().from(picks).where(eq(picks.entryId, bobEntryId));
      expect(left).toHaveLength(0);
    });
  });

  describe("the player list", () => {
    type ListRow = { id: string; displayName: string; email: string; status: string; points?: number };
    const list = async () => (await app.inject({ method: "GET", url: `/pools/${poolId}/entries` })).json() as ListRow[];

    it("shows an ordinary player their own email but not anyone else's", async () => {
      actAs(as(bob));
      const rows = await list();
      expect(rows.find((e) => e.id === bobEntryId)?.email).toBe(bob.email);
      expect(rows.find((e) => e.id === aliceEntryId)?.email).toBe("");
    });

    it("shows an admin every player's email", async () => {
      actAs(as(admin));
      const rows = await list();
      expect(rows.find((e) => e.id === aliceEntryId)?.email).toBe(alice.email);
      expect(rows.find((e) => e.id === bobEntryId)?.email).toBe(bob.email);
    });

    it("still gives an ordinary player names, status and elimination week", async () => {
      actAs(as(bob));
      const rows = await list();
      expect(rows.find((e) => e.id === aliceEntryId)).toMatchObject({
        displayName: "Alice",
        status: "alive",
        eliminatedWeek: null,
      });
    });

    it("keeps points for a pick 'em pool while hiding emails", async () => {
      const pickEm = await createPool("pick_em", defaultPickEmRulesConfig, SEASON);
      poolIds.push(pickEm.id);
      const entry = await createEntry(pickEm.id, alice.id);
      actAs(as(bob));
      const res = await app.inject({ method: "GET", url: `/pools/${pickEm.id}/entries` });
      const row = (res.json() as ListRow[]).find((e) => e.id === entry.id);
      expect(row?.points).toBe(0);
      expect(row?.email).toBe("");
    });

    it("never includes an email unless a caller asks for it", () => {
      const entry = {
        id: "e1",
        poolId: "p1",
        status: "alive" as const,
        eliminatedWeek: null,
        createdAt: new Date(),
        invitedName: null,
        invitedEmail: "invited@example.com",
        user: null,
      };
      expect(resolveEntry(entry).email).toBe("");
      expect(resolveEntry(entry, undefined, WITH_EMAIL).email).toBe("invited@example.com");
    });

    it("does not show other players' email addresses to an ordinary player", async () => {
      actAs(as(bob));
      const res = await app.inject({ method: "GET", url: `/pools/${poolId}/entries` });
      expect(res.statusCode).toBe(200);
      const list = res.json() as { id: string; email: string }[];
      const alicesRow = list.find((e) => e.id === aliceEntryId);
      expect(alicesRow).toBeDefined();
      expect(alicesRow?.email).toBe("");
    });
  });
});
