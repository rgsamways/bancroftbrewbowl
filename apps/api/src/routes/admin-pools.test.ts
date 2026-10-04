import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, entries, pools } from "../db/schema.js";
import { cleanupFixtures, createEntry, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

describe("admin pool management rules", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const userIds: string[] = [];
  let season = 2910;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), [], userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const pool = async (type: "survivor" | "pick_em" = "survivor") => {
    const p =
      type === "survivor"
        ? await createPool("survivor", defaultSurvivorRulesConfig, season++)
        : await createPool("pick_em", defaultPickEmRulesConfig, season++);
    poolIds.push(p.id);
    return p;
  };
  const send = (method: "POST" | "PATCH" | "GET", url: string, payload?: object) => app.inject({ method, url, payload });
  const entryRow = (id: string) => db.query.entries.findFirst({ where: eq(entries.id, id) });

  describe("editing a player's status", () => {
    it("restores an eliminated player and clears the week; eliminates with a week; both are recorded", async () => {
      const admin = await person("Roster Admin", true);
      const p = await pool();
      const out = await person("Out Player");
      const e = await createEntry(p.id, out.id);
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 3 }).where(eq(entries.id, e.id));
      actAs(as(admin));

      expect((await send("PATCH", `/entries/${e.id}`, { status: "alive" })).statusCode).toBe(200);
      expect(await entryRow(e.id)).toMatchObject({ status: "alive", eliminatedWeek: null });

      expect((await send("PATCH", `/entries/${e.id}`, { status: "eliminated", eliminatedWeek: 5 })).statusCode).toBe(200);
      expect(await entryRow(e.id)).toMatchObject({ status: "eliminated", eliminatedWeek: 5 });

      // Changing only the week of an eliminated player is fine.
      expect((await send("PATCH", `/entries/${e.id}`, { eliminatedWeek: 4 })).statusCode).toBe(200);
      expect((await entryRow(e.id))!.eliminatedWeek).toBe(4);

      const [last] = await db.select().from(adminActivity).where(eq(adminActivity.actorId, admin.id)).orderBy(desc(adminActivity.createdAt));
      expect(last).toMatchObject({ kind: "player_status_changed", affectsOwnEntry: false });
      await db.delete(adminActivity).where(eq(adminActivity.actorId, admin.id));
    });

    it("refuses Out without a week, a bad week, an unknown field, and a week on an alive player", async () => {
      const admin = await person("Roster Admin", true);
      const p = await pool();
      const alive = await createEntry(p.id, (await person("Alive Player")).id);
      actAs(as(admin));

      for (const bad of [{ status: "eliminated" }, { status: "eliminated", eliminatedWeek: 99 }, { status: "eliminated", eliminatedWeek: 0 }, { status: "eliminated", eliminatedWeek: 2.5 }, { status: "banned" }, { points: 5 }, {}, { eliminatedWeek: 3 }]) {
        const res = await send("PATCH", `/entries/${alive.id}`, bad);
        expect(res.statusCode, JSON.stringify(bad)).toBe(400);
      }
      expect(await entryRow(alive.id)).toMatchObject({ status: "alive", eliminatedWeek: null });
      expect(await db.select().from(adminActivity).where(eq(adminActivity.actorId, admin.id))).toHaveLength(0);
    });

    it("is for admins only and flags an admin's own entry", async () => {
      const admin = await person("Own Admin", true);
      const player = await person("Plain Player");
      const p = await pool();
      const mine = await createEntry(p.id, admin.id);
      actAs(as(player));
      expect((await send("PATCH", `/entries/${mine.id}`, { status: "alive" })).statusCode).toBe(403);
      actAs(as(admin));
      expect((await send("PATCH", `/entries/${mine.id}`, { status: "eliminated", eliminatedWeek: 1 })).statusCode).toBe(200);
      const [last] = await db.select().from(adminActivity).where(eq(adminActivity.actorId, admin.id));
      expect(last!.affectsOwnEntry).toBe(true);
      await db.delete(adminActivity).where(eq(adminActivity.actorId, admin.id));
    });
  });

  describe("adding a player", () => {
    it("links an existing account, asks for a name for an unknown email, and never adds twice", async () => {
      const admin = await person("Add Admin", true);
      const p = await pool();
      const existing = await person("Existing Person");
      actAs(as(admin));

      const linked = await send("POST", `/pools/${p.id}/entries`, { email: existing.email });
      expect(linked.statusCode).toBe(201);
      expect(linked.json().displayName).toBe("Existing Person");

      const unknownEmail = `new-${crypto.randomUUID()}@example.com`;
      const needsName = await send("POST", `/pools/${p.id}/entries`, { email: unknownEmail });
      expect(needsName.statusCode).toBe(422);
      expect(needsName.json().code).toBe("NAME_REQUIRED");

      const invited = await send("POST", `/pools/${p.id}/entries`, { email: unknownEmail, display_name: "New Person" });
      expect(invited.statusCode).toBe(201);
      expect(invited.json().displayName).toBe("New Person");

      // Adding the same people again returns what is there and creates nothing.
      const before = (await db.query.entries.findMany({ where: eq(entries.poolId, p.id) })).length;
      expect((await send("POST", `/pools/${p.id}/entries`, { email: existing.email })).statusCode).toBe(200);
      expect((await send("POST", `/pools/${p.id}/entries`, { email: unknownEmail })).statusCode).toBe(200); // already invited: no name needed
      expect((await db.query.entries.findMany({ where: eq(entries.poolId, p.id) })).length).toBe(before);
      await db.delete(adminActivity).where(eq(adminActivity.actorId, admin.id));
    });

    it("is for admins only", async () => {
      const player = await person("Plain Player");
      const p = await pool();
      actAs(as(player));
      expect((await send("POST", `/pools/${p.id}/entries`, { email: "x@example.com", display_name: "X" })).statusCode).toBe(403);
    });
  });

  describe("the roster", () => {
    it("tells an admin who is invited and which entry is theirs; a player gets neither flag", async () => {
      const admin = await person("Flag Admin", true);
      const player = await person("Flag Player");
      const p = await pool();
      await createEntry(p.id, admin.id);
      await createEntry(p.id, player.id);
      await createEntry(p.id); // an invited entry with no account
      actAs(as(admin));
      const seenByAdmin = (await send("GET", `/pools/${p.id}/entries`)).json() as { displayName: string; invited?: boolean; isYou?: boolean }[];
      expect(seenByAdmin.find((e) => e.displayName === "Flag Admin")).toMatchObject({ invited: false, isYou: true });
      expect(seenByAdmin.find((e) => e.displayName === "Flag Player")).toMatchObject({ invited: false, isYou: false });
      expect(seenByAdmin.find((e) => e.displayName === "Test Entry")).toMatchObject({ invited: true, isYou: false });

      actAs(as(player));
      const seenByPlayer = (await send("GET", `/pools/${p.id}/entries`)).json() as Record<string, unknown>[];
      for (const row of seenByPlayer) {
        expect(row).not.toHaveProperty("invited");
        expect(row).not.toHaveProperty("isYou");
      }
    });
  });

  describe("the rules lock", () => {
    it("refuses name, season and rule changes on a locked pool, but not the total or the lock itself", async () => {
      const admin = await person("Lock Admin", true);
      const p = await pool(); // created active, so locked
      actAs(as(admin));

      for (const change of [{ name: "Renamed" }, { season_year: 2099 }, { rules: { allow_repeat_teams: true } }]) {
        const res = await send("PATCH", `/pools/${p.id}`, change);
        expect(res.statusCode, JSON.stringify(change)).toBe(409);
        expect(res.json().error).toBe("The rules are locked. Unlock the pool to change them.");
      }
      const unchanged = await db.query.pools.findFirst({ where: eq(pools.id, p.id) });
      expect(unchanged).toMatchObject({ name: p.name, seasonYear: p.seasonYear });

      // Re-saving the same values is not a change.
      expect((await send("PATCH", `/pools/${p.id}`, { name: p.name })).statusCode).toBe(200);
      // The total and the lock itself always work.
      expect((await send("PATCH", `/pools/${p.id}`, { pool_total_cents: 1500 })).statusCode).toBe(200);
      expect((await send("PATCH", `/pools/${p.id}`, { status: "draft" })).statusCode).toBe(200);
      await db.delete(adminActivity).where(eq(adminActivity.actorId, admin.id));
    });

    it("allows changes while unlocked, and unlocking plus editing in one request", async () => {
      const admin = await person("Lock Admin", true);
      const p = await pool();
      actAs(as(admin));

      // Unlock and rename together.
      const both = await send("PATCH", `/pools/${p.id}`, { status: "draft", name: "Edited While Unlocking" });
      expect(both.statusCode).toBe(200);
      expect(both.json()).toMatchObject({ name: "Edited While Unlocking", status: "draft" });

      // Now unlocked: edits work.
      expect((await send("PATCH", `/pools/${p.id}`, { rules: { allow_repeat_teams: true } })).statusCode).toBe(200);

      // Lock it again; edits are refused again.
      expect((await send("PATCH", `/pools/${p.id}`, { status: "active" })).statusCode).toBe(200);
      expect((await send("PATCH", `/pools/${p.id}`, { name: "Too Late" })).statusCode).toBe(409);
      await db.delete(adminActivity).where(eq(adminActivity.actorId, admin.id));
    });

    it("applies to Pick 'em pools too", async () => {
      const admin = await person("Lock Admin", true);
      const p = await pool("pick_em");
      actAs(as(admin));
      expect((await send("PATCH", `/pools/${p.id}`, { rules: { tie_handling: "everyone_correct" } })).statusCode).toBe(409);
    });
  });
});
