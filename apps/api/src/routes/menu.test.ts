import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import type { MenuItem, PublicMenu } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity, menuItems } from "../db/schema.js";
import { cleanupFixtures, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

describe("the menu", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const itemIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    if (itemIds.length > 0) await db.delete(menuItems).where(inArray(menuItems.id, itemIds.splice(0)));
    await cleanupFixtures([], [], userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const send = (method: "POST" | "PATCH" | "GET" | "DELETE", url: string, payload?: object) => app.inject({ method, url, payload });
  const add = async (payload: object) => {
    const res = await send("POST", "/menu/items", payload);
    if (res.statusCode === 201) itemIds.push((res.json() as MenuItem).id);
    return res;
  };
  const publicMenu = async () => (await send("GET", "/public/menu")).json() as PublicMenu;
  const records = (u: User) => db.select().from(adminActivity).where(eq(adminActivity.actorId, u.id));

  describe("reading", () => {
    it("needs no sign-in, groups drinks into their three sections and dishes by section, and is always revalidated", async () => {
      const admin = await person("Menu Admin", true);
      actAs(as(admin));
      await add({ kind: "beer", name: "Zz Test Lager", style: "Lager", abv: "4.8%" });
      await add({ kind: "wine", name: "Zz Test Red" });
      await add({ kind: "dish", section: "Zz Test Plates", name: "Zz Test Ribs", priceCents: 1800, options: [{ name: "Add brisket", priceCents: 900 }] });

      actAs(null);
      const res = await send("GET", "/public/menu");
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toContain("must-revalidate");
      const menu = res.json() as PublicMenu;
      expect(menu.drinks.map((s) => s.name)).toEqual(["On tap", "Wine", "Other drinks"]);
      expect(menu.drinks[0]!.items.map((i) => i.name)).toContain("Zz Test Lager");
      expect(menu.drinks[1]!.items.map((i) => i.name)).toContain("Zz Test Red");
      const plates = menu.kitchen.find((s) => s.name === "Zz Test Plates")!;
      expect(plates.items[0]).toMatchObject({ name: "Zz Test Ribs", priceCents: 1800, options: [{ name: "Add brisket", priceCents: 900 }], available: true });
    });

    it("sends nothing private", async () => {
      const admin = await person("Menu Admin", true);
      actAs(as(admin));
      await add({ kind: "beer", name: "Zz Test Ale" });
      actAs(null);
      const body = (await send("GET", "/public/menu")).body;
      expect(body).not.toContain(admin.email);
      expect(body).not.toContain(admin.id);
      expect(body).not.toContain("createdAt");
    });
  });

  describe("changing", () => {
    it("refuses signed-out callers and players on every write, and changes nothing", async () => {
      const admin = await person("Menu Admin", true);
      const player = await person("Menu Player");
      actAs(as(admin));
      const id = ((await add({ kind: "beer", name: "Zz Test Stout" })).json() as MenuItem).id;

      for (const [who, code] of [
        [null, 401],
        [as(player), 403],
      ] as const) {
        actAs(who);
        expect((await send("GET", "/menu/items")).statusCode).toBe(code);
        expect((await send("POST", "/menu/items", { kind: "beer", name: "Nope" })).statusCode).toBe(code);
        expect((await send("PATCH", `/menu/items/${id}`, { name: "Nope" })).statusCode).toBe(code);
        expect((await send("PATCH", `/menu/items/${id}/availability`, { available: false })).statusCode).toBe(code);
        expect((await send("DELETE", `/menu/items/${id}`)).statusCode).toBe(code);
      }
      const row = await db.query.menuItems.findFirst({ where: eq(menuItems.id, id) });
      expect(row).toMatchObject({ name: "Zz Test Stout", available: true });
    });

    it("an item with only a name and kind is accepted, with no style, strength, price or description", async () => {
      actAs(as(await person("Menu Admin", true)));
      const res = await add({ kind: "beer", name: "Zz Test Plain" });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ section: "On tap", style: null, abv: null, description: null, priceCents: null, options: [], labels: [], available: true });
    });

    it("refuses bad input", async () => {
      actAs(as(await person("Menu Admin", true)));
      const bad: object[] = [
        { kind: "beer" },
        { kind: "beer", name: "" },
        { kind: "beer", name: "x".repeat(81) },
        { kind: "cocktail", name: "Zz" },
        { kind: "beer", name: "Zz", labels: ["spicy"] },
        { kind: "beer", name: "Zz", labels: ["new", "new"] },
        { kind: "beer", name: "Zz", priceCents: -1 },
        { kind: "beer", name: "Zz", priceCents: 4.5 },
        { kind: "beer", name: "Zz", options: Array.from({ length: 13 }, (_, i) => ({ name: `o${i}` })) },
        { kind: "dish", name: "Zz Dish" },
        { kind: "beer", name: "Zz", extra: 1 },
      ];
      for (const payload of bad) expect((await send("POST", "/menu/items", payload)).statusCode, JSON.stringify(payload)).toBe(400);
    });

    it("edits an item, keeps its type, and the public menu shows the change", async () => {
      actAs(as(await person("Menu Admin", true)));
      const id = ((await add({ kind: "beer", name: "Zz Test IPA" })).json() as MenuItem).id;
      const res = await send("PATCH", `/menu/items/${id}`, { name: "Zz Test IPA 2", style: "IPA", abv: "6.2%", labels: ["new"], priceCents: 750 });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ name: "Zz Test IPA 2", style: "IPA", abv: "6.2%", labels: ["new"], priceCents: 750 });
      expect((await send("PATCH", `/menu/items/${id}`, { kind: "wine", name: "Zz" })).statusCode).toBe(400);
      expect((await send("PATCH", `/menu/items/${crypto.randomUUID()}`, { name: "Zz" })).statusCode).toBe(404);
      actAs(null);
      expect((await publicMenu()).drinks[0]!.items.find((i) => i.id === id)).toMatchObject({ name: "Zz Test IPA 2", abv: "6.2%" });
    });

    it("switching an item out shows on the public menu straight away; the item stays, marked out", async () => {
      actAs(as(await person("Menu Admin", true)));
      const id = ((await add({ kind: "beer", name: "Zz Test Pale" })).json() as MenuItem).id;
      expect((await send("PATCH", `/menu/items/${id}/availability`, { available: false })).statusCode).toBe(200);
      actAs(null);
      expect((await publicMenu()).drinks[0]!.items.find((i) => i.id === id)).toMatchObject({ available: false });
    });

    it("removing is permanent", async () => {
      actAs(as(await person("Menu Admin", true)));
      const id = ((await add({ kind: "beer", name: "Zz Test Gone" })).json() as MenuItem).id;
      expect((await send("DELETE", `/menu/items/${id}`)).statusCode).toBe(204);
      expect((await send("DELETE", `/menu/items/${id}`)).statusCode).toBe(404);
      expect((await publicMenu()).drinks[0]!.items.find((i) => i.id === id)).toBeUndefined();
    });

    it("shows items in the order added", async () => {
      actAs(as(await person("Menu Admin", true)));
      const a = ((await add({ kind: "beer", name: "Zz Test First" })).json() as MenuItem).id;
      const b = ((await add({ kind: "beer", name: "Zz Test Second" })).json() as MenuItem).id;
      const ids = (await publicMenu()).drinks[0]!.items.map((i) => i.id);
      expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
    });

    it("records each change in Activity with who made it", async () => {
      const admin = await person("Menu Admin", true);
      actAs(as(admin));
      const id = ((await add({ kind: "beer", name: "Zz Test Logged" })).json() as MenuItem).id;
      await send("PATCH", `/menu/items/${id}`, { name: "Zz Test Logged" });
      await send("PATCH", `/menu/items/${id}/availability`, { available: false });
      await send("DELETE", `/menu/items/${id}`);
      const rows = await records(admin);
      expect(rows.map((r) => r.kind).sort()).toEqual(["menu_item_added", "menu_item_availability_changed", "menu_item_changed", "menu_item_removed"]);
      expect(rows.every((r) => r.affectsOwnEntry === false && r.actorName === "Menu Admin")).toBe(true);
    });
  });
});
