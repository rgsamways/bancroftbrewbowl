import { defaultSurvivorRulesConfig, type AdminRequestDetail, type AdminSummary } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, adminRequests, entries, wipeoutEvents } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;

// Below 3500 so the admin summary tests, which need the latest season, are never displaced.
let season = 3400;

describe("admin confirmations", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];

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
  const send = (method: "POST" | "PATCH" | "GET", url: string, payload?: object) => app.inject({ method, url, payload });
  const records = (u: User) => db.select().from(adminActivity).where(eq(adminActivity.actorId, u.id)).orderBy(asc(adminActivity.createdAt));
  const requestRow = (id: string) => db.query.adminRequests.findFirst({ where: eq(adminRequests.id, id) });
  const entryRow = (id: string) => db.query.entries.findFirst({ where: eq(entries.id, id) });

  /** Two admins who both play, plus a plain player, all in one pool with a wipeout waiting. */
  async function wipeoutScene() {
    const s = season++;
    const alex = await person("Alex Admin", true);
    const sam = await person("Sam Admin", true);
    const plain = await person("Plain Player");
    const p = await createPool("survivor", defaultSurvivorRulesConfig, s);
    poolIds.push(p.id);
    const mine = await createEntry(p.id, alex.id);
    const samEntry = await createEntry(p.id, sam.id);
    const theirs = await createEntry(p.id, plain.id);
    const g = await createGame({ seasonYear: s, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: new Date(Date.now() - 5 * HOUR) });
    gameIds.push(g.id);
    for (const e of [mine, samEntry, theirs]) await createPick(e.id, 1, "KC");
    const [event] = await db
      .insert(wipeoutEvents)
      .values({ poolId: p.id, weekNumber: 1, gameId: g.id, candidateEntryIds: [mine.id, samEntry.id, theirs.id] })
      .returning();
    return { alex, sam, plain, p, mine, samEntry, theirs, event: event! };
  }
  const resolve = (scene: Awaited<ReturnType<typeof wipeoutScene>>, keep: string[]) =>
    send("POST", `/pools/${scene.p.id}/wipeouts/${scene.event.id}/resolve`, { surviving_entry_ids: keep });

  describe("when a choice becomes a request", () => {
    it("keeping yourself alive in a wipeout asks another admin and changes nothing", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const res = await resolve(sc, [sc.mine.id, sc.theirs.id]);
      expect(res.statusCode).toBe(202);
      const body = res.json() as { request: { id: string; askedAdmins: string[] } };
      expect(body.request.askedAdmins).toContain("Sam Admin");

      expect((await entryRow(sc.mine.id))!.status).toBe("alive");
      expect((await entryRow(sc.samEntry.id))!.status).toBe("alive");
      const event = await db.query.wipeoutEvents.findFirst({ where: eq(wipeoutEvents.id, sc.event.id) });
      expect(event!.resolvedAt).toBeNull();
      expect(await requestRow(body.request.id)).toMatchObject({ status: "pending", kind: "wipeout_resolution", requestedBy: sc.alex.id });
      expect(await records(sc.alex)).toMatchObject([{ kind: "confirmation_requested", affectsOwnEntry: true, poolId: sc.p.id }]);
    });

    it("leaving yourself out of the kept players applies at once", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const res = await resolve(sc, [sc.theirs.id]);
      expect(res.statusCode).toBe(200);
      expect(await entryRow(sc.mine.id)).toMatchObject({ status: "eliminated", eliminatedWeek: 1 });
      expect(await db.select().from(adminRequests).where(eq(adminRequests.poolId, sc.p.id))).toHaveLength(0);
    });

    it("changing your own status asks; changing someone else's applies", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const own = await send("PATCH", `/entries/${sc.mine.id}`, { status: "eliminated", eliminatedWeek: 2 });
      expect(own.statusCode).toBe(202);
      expect((await entryRow(sc.mine.id))!.status).toBe("alive");
      const row = await requestRow((own.json() as { request: { id: string } }).request.id);
      expect(row).toMatchObject({ kind: "status_change", status: "pending", entryId: sc.mine.id });

      expect((await send("PATCH", `/entries/${sc.theirs.id}`, { status: "eliminated", eliminatedWeek: 2 })).statusCode).toBe(200);
      expect((await entryRow(sc.theirs.id))!.status).toBe("eliminated");
    });

    it("a second request for the same thing replaces the first", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const first = (await resolve(sc, [sc.mine.id])).json() as { request: { id: string } };
      const second = (await resolve(sc, [sc.mine.id, sc.theirs.id])).json() as { request: { id: string } };
      expect((await requestRow(first.request.id))!.status).toBe("cancelled");
      expect((await requestRow(second.request.id))!.status).toBe("pending");
    });
  });

  describe("confirming and declining", () => {
    it("another admin confirms: the choice is applied and both steps are recorded", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id, sc.theirs.id])).json() as { request: { id: string } }).request.id;

      actAs(as(sc.sam));
      const res = await send("POST", `/admin/requests/${id}/confirm`);
      expect(res.statusCode).toBe(200);

      expect((await entryRow(sc.mine.id))!.status).toBe("alive");
      expect((await entryRow(sc.theirs.id))!.status).toBe("alive");
      expect(await entryRow(sc.samEntry.id)).toMatchObject({ status: "eliminated", eliminatedWeek: 1 });
      const event = await db.query.wipeoutEvents.findFirst({ where: eq(wipeoutEvents.id, sc.event.id) });
      expect(event).toMatchObject({ resolvedBy: sc.sam.id, survivingEntryIds: [sc.mine.id, sc.theirs.id] });
      expect(await requestRow(id)).toMatchObject({ status: "confirmed", decidedBy: sc.sam.id, decidedByName: "Sam Admin" });
      expect((await records(sc.alex)).map((r) => r.kind)).toEqual(["confirmation_requested"]);
      expect(await records(sc.sam)).toMatchObject([{ kind: "confirmation_confirmed", affectsOwnEntry: true }]);

      // Done once: a second confirm is refused.
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(409);
    });

    it("confirming a status change applies it", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await send("PATCH", `/entries/${sc.mine.id}`, { status: "eliminated", eliminatedWeek: 4 })).json() as { request: { id: string } }).request.id;
      actAs(as(sc.sam));
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(200);
      expect(await entryRow(sc.mine.id)).toMatchObject({ status: "eliminated", eliminatedWeek: 4 });
    });

    it("the requester cannot confirm or decline their own request, and players cannot either", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id])).json() as { request: { id: string } }).request.id;
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(403);
      expect((await send("POST", `/admin/requests/${id}/decline`, {})).statusCode).toBe(403);
      actAs(as(sc.plain));
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(403);
      expect((await send("POST", `/admin/requests/${id}/decline`, {})).statusCode).toBe(403);
      actAs(null);
      expect((await send("GET", `/admin/requests/${id}`)).statusCode).toBe(401);
      expect((await requestRow(id))!.status).toBe("pending");
      expect((await entryRow(sc.mine.id))!.status).toBe("alive");
    });

    it("declining keeps the reason, applies nothing, and shows the requester a note until dismissed", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id])).json() as { request: { id: string } }).request.id;

      actAs(as(sc.sam));
      expect((await send("POST", `/admin/requests/${id}/decline`, { reason: "Check the result first" })).statusCode).toBe(200);
      expect(await requestRow(id)).toMatchObject({ status: "declined", declineReason: "Check the result first", decidedBy: sc.sam.id });
      expect((await entryRow(sc.samEntry.id))!.status).toBe("alive");
      expect(await records(sc.sam)).toMatchObject([{ kind: "confirmation_declined", affectsOwnEntry: true }]);

      actAs(as(sc.alex));
      let summary = (await send("GET", "/admin/summary")).json() as AdminSummary;
      expect(summary.next).toMatchObject({ kind: "declined", request: { id, declineReason: "Check the result first", decidedByName: "Sam Admin" } });

      // Only the requester can dismiss it.
      actAs(as(sc.sam));
      expect((await send("POST", `/admin/requests/${id}/seen`)).statusCode).toBe(404);
      actAs(as(sc.alex));
      expect((await send("POST", `/admin/requests/${id}/seen`)).statusCode).toBe(200);
      summary = (await send("GET", "/admin/summary")).json() as AdminSummary;
      expect(summary.requests.declined).toHaveLength(0);
      expect(summary.next.kind).not.toBe("declined");
    });

    it("an over-long reason is refused", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id])).json() as { request: { id: string } }).request.id;
      actAs(as(sc.sam));
      expect((await send("POST", `/admin/requests/${id}/decline`, { reason: "x".repeat(201) })).statusCode).toBe(400);
      expect((await requestRow(id))!.status).toBe("pending");
    });
  });

  describe("requests that are out of date", () => {
    it("confirming after the entry changed applies nothing and cancels the request", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await send("PATCH", `/entries/${sc.mine.id}`, { status: "eliminated", eliminatedWeek: 4 })).json() as { request: { id: string } }).request.id;
      // Changed behind the request's back (for example directly in the database).
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 9 }).where(eq(entries.id, sc.mine.id));
      actAs(as(sc.sam));
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(409);
      expect((await requestRow(id))!.status).toBe("cancelled");
      expect((await entryRow(sc.mine.id))!.eliminatedWeek).toBe(9);
    });

    it("another admin resolving the wipeout directly cancels the waiting request", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id])).json() as { request: { id: string } }).request.id;
      // Sam does not keep himself, so his choice stands on its own.
      actAs(as(sc.sam));
      expect((await resolve(sc, [sc.theirs.id])).statusCode).toBe(200);
      expect((await requestRow(id))!.status).toBe("cancelled");
      expect(await entryRow(sc.mine.id)).toMatchObject({ status: "eliminated" });
      expect((await send("POST", `/admin/requests/${id}/confirm`)).statusCode).toBe(409);
    });
  });

  describe("Next step", () => {
    it("shows other admins the confirm card, and the requester a waiting line without the wipeout", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const before = (await send("GET", "/admin/summary")).json() as AdminSummary;
      expect(before.next.kind).toBe("wipeout");
      const id = ((await resolve(sc, [sc.mine.id])).json() as { request: { id: string } }).request.id;

      const mine = (await send("GET", "/admin/summary")).json() as AdminSummary;
      expect(mine.requests.waiting.map((r) => r.id)).toEqual([id]);
      expect(mine.wipeouts.map((w) => w.wipeoutId)).not.toContain(sc.event.id);
      expect(mine.next.kind).not.toBe("confirm");

      actAs(as(sc.sam));
      const theirs = (await send("GET", "/admin/summary")).json() as AdminSummary;
      expect(theirs.next).toMatchObject({ kind: "confirm", request: { id, requestedByName: "Alex Admin", poolId: sc.p.id } });
    });
  });

  describe("the request details", () => {
    it("show names, who was kept and the picks, and no email addresses", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      const id = ((await resolve(sc, [sc.mine.id, sc.theirs.id])).json() as { request: { id: string } }).request.id;
      actAs(as(sc.sam));
      const res = await send("GET", `/admin/requests/${id}`);
      expect(res.statusCode).toBe(200);
      const detail = res.json() as AdminRequestDetail;
      expect(detail).toMatchObject({ status: "pending", canDecide: true, isRequester: false, requestedByName: "Alex Admin", weekNumber: 1 });
      const byName = Object.fromEntries(detail.players.map((p) => [p.displayName, p]));
      expect(byName["Alex Admin"]).toMatchObject({ kept: true, isRequesterEntry: true, pickedTeams: ["KC"] });
      expect(byName["Sam Admin"]).toMatchObject({ kept: false });
      for (const u of [sc.alex, sc.sam, sc.plain]) expect(res.body).not.toContain(u.email);

      actAs(as(sc.alex));
      expect(((await send("GET", `/admin/requests/${id}`)).json() as AdminRequestDetail).canDecide).toBe(false);
      actAs(as(sc.plain));
      expect((await send("GET", `/admin/requests/${id}`)).statusCode).toBe(403);
    });

    it("clean up: requests go with their pool", async () => {
      const sc = await wipeoutScene();
      actAs(as(sc.alex));
      await resolve(sc, [sc.mine.id]);
      const ids = (await db.select().from(adminRequests).where(eq(adminRequests.poolId, sc.p.id))).map((r) => r.id);
      expect(ids).toHaveLength(1);
      await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), []);
      expect(await db.select().from(adminRequests).where(inArray(adminRequests.id, ids))).toHaveLength(0);
    });
  });
});
