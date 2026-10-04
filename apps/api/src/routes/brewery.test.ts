import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { addDays, easternToday, weekdayOf, type BreweryItem, type MeSummary, type MenuItem } from "@bbb/shared";
import { defaultSurvivorRulesConfig } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity, games, menuItems, promotions } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const today = easternToday(new Date());

// These tests read "the current week of the latest season", so they build their own season far
// above everything else (3700 and up) and a week 1 that has not been decided yet.
let season = 3700;

describe("From the brewery", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const itemIds: string[] = [];
  const promoIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    if (promoIds.length > 0) await db.delete(promotions).where(inArray(promotions.id, promoIds.splice(0)));
    if (itemIds.length > 0) await db.delete(menuItems).where(inArray(menuItems.id, itemIds.splice(0)));
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const send = (method: "POST" | "GET" | "DELETE", url: string, payload?: object) => app.inject({ method, url, payload });
  const post = async (url: string, payload: object) => {
    const res = await send("POST", url, payload);
    if (res.statusCode === 201) promoIds.push((res.json() as { id: string }).id);
    return res;
  };
  const beer = async (name: string, available = true) => {
    const [row] = await db.insert(menuItems).values({ kind: "beer", section: "On tap", name, style: "IPA", abv: "6.2%", available }).returning();
    itemIds.push(row!.id);
    return row! as unknown as MenuItem;
  };
  /** A season whose week 1 is still to be played, so it is "the current week". */
  async function scene() {
    const s = season++;
    const g = await createGame({ seasonYear: s, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: new Date(Date.now() + 5 * HOUR) });
    const g2 = await createGame({ seasonYear: s, weekNumber: 2, homeTeam: "DAL", awayTeam: "PHI", kickoffTime: new Date(Date.now() + 5 * 24 * HOUR) });
    gameIds.push(g.id, g2.id);
    return s;
  }
  const summaryFor = async (u: User) => {
    actAs(as(u));
    return (await send("GET", "/me/summary")).json() as MeSummary;
  };
  const records = (u: User) => db.select().from(adminActivity).where(eq(adminActivity.actorId, u.id));

  it("refuses signed-out callers and players on every route, and changes nothing", async () => {
    const player = await person("Brew Player");
    const item = await beer("Zz Test Beer");
    for (const [who, code] of [
      [null, 401],
      [as(player), 403],
    ] as const) {
      actAs(who);
      expect((await send("GET", "/brewery/items")).statusCode).toBe(code);
      expect((await send("POST", "/brewery/features", { menuItemId: item.id, scope: "open" })).statusCode).toBe(code);
      expect((await send("POST", "/brewery/specials", { title: "Nope", days: [0] })).statusCode).toBe(code);
      expect((await send("POST", "/brewery/announcements", { title: "Nope", message: "Nope", weekNumber: 1 })).statusCode).toBe(code);
      expect((await send("DELETE", `/brewery/items/${crypto.randomUUID()}`)).statusCode).toBe(code);
    }
  });

  describe("featuring a menu item", () => {
    it("shows on Home, replaces the previous feature, and goes when the item is switched off or removed", async () => {
      const admin = await person("Brew Admin", true);
      await scene();
      const a = await beer("Zz Hawkwatch");
      const b = await beer("Zz Blonde");
      actAs(as(admin));
      expect((await post("/brewery/features", { menuItemId: a.id, scope: "open" })).statusCode).toBe(201);
      expect((await summaryFor(admin)).brewery.featured).toMatchObject({ name: "Zz Hawkwatch", style: "IPA", abv: "6.2%" });

      expect((await post("/brewery/features", { menuItemId: b.id, scope: "week" })).statusCode).toBe(201);
      expect((await summaryFor(admin)).brewery.featured).toMatchObject({ name: "Zz Blonde" });
      expect(await db.select().from(promotions).where(eq(promotions.menuItemId, a.id))).toHaveLength(0);

      await db.update(menuItems).set({ available: false }).where(eq(menuItems.id, b.id));
      expect((await summaryFor(admin)).brewery.featured).toBeNull();
      await db.update(menuItems).set({ available: true }).where(eq(menuItems.id, b.id));
      expect((await summaryFor(admin)).brewery.featured).not.toBeNull();

      await db.delete(menuItems).where(eq(menuItems.id, b.id));
      expect((await summaryFor(admin)).brewery.featured).toBeNull();
      expect(await db.select().from(promotions).where(eq(promotions.menuItemId, b.id))).toHaveLength(0);
    });

    it("refuses an item that is not on the menu, and a bad id", async () => {
      actAs(as(await person("Brew Admin", true)));
      expect((await send("POST", "/brewery/features", { menuItemId: crypto.randomUUID(), scope: "open" })).statusCode).toBe(404);
      expect((await send("POST", "/brewery/features", { menuItemId: "nope", scope: "open" })).statusCode).toBe(400);
    });
  });

  describe("specials", () => {
    it("show on their days only, with the schedule in words", async () => {
      const admin = await person("Brew Admin", true);
      await scene();
      const otherDay = (weekdayOf(today) + 3) % 7;
      actAs(as(admin));
      expect((await post("/brewery/specials", { title: "Zz Today Special", details: "Wings", tag: "game_day", days: [weekdayOf(today)], startTime: "13:00", endTime: "16:00" })).statusCode).toBe(201);
      expect((await post("/brewery/specials", { title: "Zz Other Day", days: [otherDay] })).statusCode).toBe(201);
      expect((await post("/brewery/specials", { title: "Zz One Night", date: addDays(today, 1) })).statusCode).toBe(201);
      expect((await post("/brewery/specials", { title: "Zz Tonight", date: today, startTime: "19:00" })).statusCode).toBe(201);

      const specials = (await summaryFor(admin)).brewery.specials.filter((s) => s.title.startsWith("Zz"));
      expect(specials.map((s) => s.title).sort()).toEqual(["Zz Today Special", "Zz Tonight"]);
      expect(specials.find((s) => s.title === "Zz Today Special")).toMatchObject({ details: "Wings", tag: "game_day" });
      expect(specials.find((s) => s.title === "Zz Today Special")!.when).toMatch(/s, 1 – 4 PM$/);
    });

    it("refuses bad input and a date that has gone", async () => {
      actAs(as(await person("Brew Admin", true)));
      const bad: object[] = [{ title: "No when" }, { title: "Both", days: [1], date: today }, { title: "Zz", days: [1], endTime: "16:00" }, { title: "Zz", date: addDays(today, -1) }];
      for (const payload of bad) expect((await send("POST", "/brewery/specials", payload)).statusCode, JSON.stringify(payload)).toBe(400);
    });
  });

  describe("announcements", () => {
    it("show during their week only; Home otherwise has none (it shows the standard message)", async () => {
      const admin = await person("Brew Admin", true);
      await scene();
      actAs(as(admin));
      expect((await summaryFor(admin)).brewery.announcement).toBeNull();
      expect((await post("/brewery/announcements", { title: "Zz Week One", message: "Come on in", weekNumber: 1 })).statusCode).toBe(201);
      expect((await post("/brewery/announcements", { title: "Zz Week Two", message: "Next week", weekNumber: 2 })).statusCode).toBe(201);
      expect((await summaryFor(admin)).brewery.announcement).toEqual({ title: "Zz Week One", message: "Come on in" });
    });

    it("refuses a week that has gone, one past the season, and no current week at all", async () => {
      const admin = await person("Brew Admin", true);
      const s = season++;
      // Week 1 is decided, so the current week is 2.
      const g1 = await createGame({ seasonYear: s, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: new Date(Date.now() - 48 * HOUR) });
      const g2 = await createGame({ seasonYear: s, weekNumber: 2, homeTeam: "DAL", awayTeam: "PHI", kickoffTime: new Date(Date.now() + 48 * HOUR) });
      gameIds.push(g1.id, g2.id);
      await db.update(games).set({ result: "home_win" }).where(eq(games.id, g1.id));
      actAs(as(admin));
      expect((await send("POST", "/brewery/announcements", { title: "Zz", message: "Old", weekNumber: 1 })).statusCode).toBe(400);
      expect((await send("POST", "/brewery/announcements", { title: "Zz", message: "Bad", weekNumber: 23 })).statusCode).toBe(400);
      expect((await post("/brewery/announcements", { title: "Zz Now", message: "Fine", weekNumber: 2 })).statusCode).toBe(201);
    });
  });

  describe("showing now, removing and Activity", () => {
    it("lists what is showing, removes it, and records every post and removal with who made it", async () => {
      const admin = await person("Brew Admin", true);
      await scene();
      const item = await beer("Zz Listed Beer");
      actAs(as(admin));
      await post("/brewery/features", { menuItemId: item.id, scope: "open" });
      await post("/brewery/specials", { title: "Zz Listed Special", days: [0], startTime: "13:00" });
      const ann = (await post("/brewery/announcements", { title: "Zz Listed Note", message: "Hi", weekNumber: 1 })).json() as { id: string };

      const list = (await send("GET", "/brewery/items")).json() as BreweryItem[];
      const mine = list.filter((i) => i.title.startsWith("Zz"));
      expect(mine.map((i) => i.kind)).toEqual(["feature", "special", "announcement"]);
      expect(mine.map((i) => i.detail)).toEqual(["Until changed", "Sundays, 1 PM", "Week 1"]);

      expect((await send("DELETE", `/brewery/items/${ann.id}`)).statusCode).toBe(204);
      expect((await send("DELETE", `/brewery/items/${ann.id}`)).statusCode).toBe(404);
      expect((await send("DELETE", "/brewery/items/not-an-id")).statusCode).toBe(404);

      const rows = await records(admin);
      expect(rows.map((r) => r.kind).sort()).toEqual(["brewery_announcement_posted", "brewery_feature_set", "brewery_item_removed", "brewery_special_added"]);
      expect(rows.every((r) => r.actorName === "Brew Admin" && r.affectsOwnEntry === false)).toBe(true);
    });
  });

  it("Home carries the section for a player with pools, and old announcements stay valid", async () => {
    const player = await person("Brew Player");
    const s = await scene();
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, s);
    poolIds.push(pool.id);
    await createEntry(pool.id, player.id);
    // An announcement written before kinds existed has the default kind and shows in its week.
    const [row] = await db.insert(promotions).values({ seasonYear: s, weekNumber: 1, title: "Zz Old Style", description: "From before" }).returning();
    promoIds.push(row!.id);
    expect(row!.kind).toBe("announcement");
    const summary = await summaryFor(player);
    expect(summary.brewery.announcement).toEqual({ title: "Zz Old Style", message: "From before" });
    expect(summary.entries.length).toBeGreaterThan(0);
  });
});
