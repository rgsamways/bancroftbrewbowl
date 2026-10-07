import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { addDays, easternToday, type BreweryItem, type MeSummary, type Notice } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity, games, promotions } from "../db/schema.js";
import { cleanupFixtures, createGame, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const today = easternToday(new Date());

describe("site notices", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const gameIds: string[] = [];
  const promoIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    if (promoIds.length > 0) await db.delete(promotions).where(inArray(promotions.id, promoIds.splice(0)));
    await cleanupFixtures([], gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const send = (method: "POST" | "GET" | "DELETE", url: string, payload?: object) => app.inject({ method, url, payload });
  const post = async (payload: object) => {
    const res = await send("POST", "/notices", payload);
    if (res.statusCode === 201) promoIds.push((res.json() as { id: string }).id);
    return res;
  };
  const mine = async () => ((await send("GET", "/me/notices")).json() as { notices: Notice[] }).notices;

  it("refuses signed-out callers and players on the admin routes, and a signed-out caller on the player route", async () => {
    const player = await person("Notice Player");
    for (const [who, code] of [[null, 401], [as(player), 403]] as const) {
      actAs(who);
      expect((await send("GET", "/notices")).statusCode).toBe(code);
      expect((await send("POST", "/notices", { title: "Nope", message: "Nope" })).statusCode).toBe(code);
      expect((await send("DELETE", `/notices/${crypto.randomUUID()}`)).statusCode).toBe(code);
    }
    actAs(null);
    expect((await send("GET", "/me/notices")).statusCode).toBe(401);
    actAs(as(player));
    expect((await send("GET", "/me/notices")).statusCode).toBe(200);
  });

  it("an admin posts a notice, every player sees it newest first, and removing it records Activity", async () => {
    const admin = await person("Notice Admin", true);
    const player = await person("Notice Player");
    actAs(as(admin));
    expect((await post({ title: "First", message: "One" })).statusCode).toBe(201);
    const second = await post({ title: "Second", message: "Two", showThrough: addDays(today, 3) });
    expect(second.statusCode).toBe(201);

    actAs(as(player));
    const seen = await mine();
    expect(seen.map((n) => n.title)).toEqual(["Second", "First"]);
    expect(seen[0]).toMatchObject({ message: "Two", showThrough: addDays(today, 3) });

    actAs(as(admin));
    expect((await send("DELETE", `/notices/${(second.json() as { id: string }).id}`)).statusCode).toBe(204);
    actAs(as(player));
    expect((await mine()).map((n) => n.title)).toEqual(["First"]);

    const records = await db.select().from(adminActivity).where(eq(adminActivity.actorId, admin.id));
    expect(records.map((r) => r.kind).sort()).toEqual(["notice_posted", "notice_posted", "notice_removed"]);
    expect(records.some((r) => r.summary.includes("Second"))).toBe(true);
  });

  it("shows through the whole last day and not after, and refuses a date that has gone", async () => {
    const admin = await person("Notice Admin", true);
    actAs(as(admin));
    expect((await post({ title: "Today", message: "x", showThrough: today })).statusCode).toBe(201);
    expect((await mine()).map((n) => n.title)).toEqual(["Today"]);
    expect((await send("POST", "/notices", { title: "Old", message: "x", showThrough: addDays(today, -1) })).statusCode).toBe(400);
    // A notice whose last day was yesterday is not active.
    const [old] = await db.insert(promotions).values({ kind: "notice", title: "Yesterday", description: "x", onDate: addDays(today, -1) }).returning();
    promoIds.push(old!.id);
    expect((await mine()).map((n) => n.title)).toEqual(["Today"]);
  });

  it("allows three at once and refuses a fourth until one is removed", async () => {
    actAs(as(await person("Notice Admin", true)));
    const ids: string[] = [];
    for (const t of ["A", "B", "C"]) ids.push(((await post({ title: t, message: "x" })).json() as { id: string }).id);
    const fourth = await send("POST", "/notices", { title: "D", message: "x" });
    expect(fourth.statusCode).toBe(409);
    expect(fourth.json().error).toContain("Remove one first");
    await send("DELETE", `/notices/${ids[0]}`);
    expect((await post({ title: "D", message: "x" })).statusCode).toBe(201);
  });

  it("checks the fields and only removes notices", async () => {
    actAs(as(await person("Notice Admin", true)));
    for (const bad of [{ title: "", message: "x" }, { title: "x", message: "y".repeat(201) }, { title: "x", message: "y", showThrough: "2026-02-31" }, { title: "x", message: "y", html: 1 }])
      expect((await send("POST", "/notices", bad)).statusCode, JSON.stringify(bad)).toBe(400);
    const [ann] = await db.insert(promotions).values({ kind: "announcement", title: "Not a notice", description: "x", seasonYear: 3900, weekNumber: 1 }).returning();
    promoIds.push(ann!.id);
    expect((await send("DELETE", `/notices/${ann!.id}`)).statusCode).toBe(404);
    expect((await send("DELETE", "/notices/not-an-id")).statusCode).toBe(404);
  });

  it("never shows in From the brewery, on Home or in the admin list", async () => {
    const admin = await person("Notice Admin", true);
    const g = await createGame({ seasonYear: 3901, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: new Date(Date.now() + 5 * 3600_000) });
    gameIds.push(g.id);
    actAs(as(admin));
    expect((await post({ title: "Zz Big Notice", message: "Important" })).statusCode).toBe(201);
    const [ann] = await db.insert(promotions).values({ kind: "announcement", title: "Zz Week Note", description: "hello", seasonYear: 3901, weekNumber: 1 }).returning();
    promoIds.push(ann!.id);

    const home = (await send("GET", "/me/summary")).json() as MeSummary;
    expect(home.brewery.announcement?.title).toBe("Zz Week Note");
    expect(JSON.stringify(home.brewery)).not.toContain("Zz Big Notice");
    const items = (await send("GET", "/brewery/items")).json() as BreweryItem[];
    expect(items.map((i) => i.title)).toEqual(["Zz Week Note"]);
    await db.delete(games).where(eq(games.id, g.id));
    gameIds.splice(0);
  });
});
