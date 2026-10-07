import { defaultSurvivorRulesConfig, type AdminTv, type TvFeed } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, menuItems, pools, tvPlaylists, tvScreens } from "../db/schema.js";
import { cleanupFixtures, createEntry, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, emailVerified: true });

describe("TV screens and playlists", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const poolIds: string[] = [];
  const itemIds: string[] = [];
  const savedEnv = process.env.OPERATOR_EMAILS;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.OPERATOR_EMAILS = savedEnv;
  });
  afterEach(async () => {
    // Everything these tests create is named "Zz ...".
    await db.delete(tvScreens).where(eq(tvScreens.name, "Zz placeholder"));
    for (const s of await db.select().from(tvScreens)) if (s.name.startsWith("Zz ")) await db.delete(tvScreens).where(eq(tvScreens.id, s.id));
    for (const p of await db.select().from(tvPlaylists)) if (p.name.startsWith("Zz ")) await db.delete(tvPlaylists).where(eq(tvPlaylists.id, p.id));
    if (itemIds.length > 0) await db.delete(menuItems).where(inArray(menuItems.id, itemIds.splice(0)));
    await cleanupFixtures(poolIds.splice(0), [], userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const god = async () => {
    const u = await person("Zz God");
    process.env.OPERATOR_EMAILS = u.email;
    return u;
  };
  const call = async (who: User | null, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) => {
    actAs(who ? as(who) : null);
    const res = await app.inject({ method, url, payload });
    let json: unknown = null;
    try {
      json = res.json();
    } catch {
      /* no body */
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read different shapes out of each response
    return { status: res.statusCode, json: json as any, body: res.body };
  };
  const pool = async (name = "Zz Pool") => {
    const p = await createPool("survivor", defaultSurvivorRulesConfig, 3800);
    poolIds.push(p.id);
    return { ...p, name };
  };
  const playlist = async (who: User, name: string, slides: object[]) => {
    const res = await call(who, "POST", "/tv/playlists", { name, slides });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    return res.json.id as string;
  };
  const screen = async (g: User, name: string) => {
    expect((await call(g, "POST", "/tv/screens", { name })).status).toBe(201);
    const tv = (await call(g, "GET", "/tv")).json as AdminTv;
    return tv.screens.find((s) => s.name === name)!;
  };
  const feed = async (code: string) => call(null, "GET", `/public/tv/${code}`);

  it("refuses signed-out callers and players everywhere, and ordinary admins on screen setup", async () => {
    const player = await person("Zz Player");
    const admin = await person("Zz Admin", true);
    const g = await god();
    const s = await screen(g, "Zz Bar TV");
    const id = crypto.randomUUID();
    for (const [who, code] of [[null, 401], [player, 403]] as const) {
      expect((await call(who, "GET", "/tv")).status).toBe(code);
      expect((await call(who, "POST", "/tv/playlists", { name: "Zz Nope", slides: [] })).status).toBe(code);
      expect((await call(who, "PUT", `/tv/playlists/${id}`, { name: "Zz Nope", slides: [] })).status).toBe(code);
      expect((await call(who, "DELETE", `/tv/playlists/${id}`)).status).toBe(code);
      expect((await call(who, "PATCH", `/tv/screens/${s.id}`, { showQr: false })).status).toBe(code);
    }
    // An ordinary admin can edit playlists and choose what a screen plays, but not set screens up.
    process.env.OPERATOR_EMAILS = "someone-else@example.com";
    expect((await call(admin, "POST", "/tv/screens", { name: "Zz Another" })).status).toBe(403);
    expect((await call(admin, "DELETE", `/tv/screens/${s.id}`)).status).toBe(403);
    expect((await call(admin, "POST", `/tv/screens/${s.id}/reset-link`)).status).toBe(403);
    expect((await call(admin, "PATCH", `/tv/screens/${s.id}`, { name: "Zz Renamed" })).status).toBe(403);
    const view = await call(admin, "GET", "/tv");
    expect(view.status).toBe(200);
    expect(view.body).not.toContain(s.code!);
    expect((view.json as AdminTv).screens[0]!.code).toBeUndefined();
    // The god-user sees the code.
    process.env.OPERATOR_EMAILS = g.email;
    expect(((await call(g, "GET", "/tv")).json as AdminTv).screens.find((x) => x.id === s.id)!.code).toBe(s.code);
  });

  it("builds playlists: slides keep their order, a standings slide needs a real pool, names are unique, and a playlist in use cannot be deleted", async () => {
    const admin = await person("Zz Admin", true);
    const g = await god();
    const p = await pool();
    const id = await playlist(admin, "Zz Game day", [
      { kind: "standings", poolId: p.id, seconds: 15, enabled: true },
      { kind: "drinks", seconds: 20, enabled: false },
      { kind: "music", seconds: 10, enabled: true },
    ]);
    let tv = (await call(admin, "GET", "/tv")).json as AdminTv;
    expect(tv.playlists.find((x) => x.id === id)!.slides.map((s) => [s.kind, s.seconds, s.enabled])).toEqual([["standings", 15, true], ["drinks", 20, false], ["music", 10, true]]);

    // Reorder and rename by saving the whole list again.
    expect((await call(admin, "PUT", `/tv/playlists/${id}`, { name: "Zz Game day 2", slides: [{ kind: "music", seconds: 10, enabled: true }, { kind: "drinks", seconds: 20, enabled: true }] })).status).toBe(200);
    tv = (await call(admin, "GET", "/tv")).json as AdminTv;
    expect(tv.playlists.find((x) => x.id === id)).toMatchObject({ name: "Zz Game day 2", slides: [{ kind: "music" }, { kind: "drinks" }] });

    // Bad saves change nothing.
    expect((await call(admin, "POST", "/tv/playlists", { name: "Zz Bad", slides: [{ kind: "standings", seconds: 15, enabled: true }] })).status).toBe(400);
    expect((await call(admin, "POST", "/tv/playlists", { name: "Zz Bad", slides: [{ kind: "standings", poolId: crypto.randomUUID(), seconds: 15, enabled: true }] })).status).toBe(400);
    expect((await call(admin, "POST", "/tv/playlists", { name: "Zz Bad", slides: [{ kind: "drinks", seconds: 3, enabled: true }] })).status).toBe(400);
    expect((await call(admin, "POST", "/tv/playlists", { name: "zz GAME DAY 2", slides: [] })).status).toBe(409);
    expect((await call(admin, "PUT", `/tv/playlists/${crypto.randomUUID()}`, { name: "Zz Ghost", slides: [] })).status).toBe(404);

    // A playlist a screen plays cannot be deleted, until the screen plays something else.
    const s = await screen(g, "Zz Bar TV");
    expect((await call(admin, "PATCH", `/tv/screens/${s.id}`, { playlistId: id })).status).toBe(204);
    const refused = await call(admin, "DELETE", `/tv/playlists/${id}`);
    expect(refused.status).toBe(409);
    expect(refused.json.error).toContain("Zz Bar TV");
    expect((await call(admin, "PATCH", `/tv/screens/${s.id}`, { playlistId: null })).status).toBe(204);
    expect((await call(admin, "DELETE", `/tv/playlists/${id}`)).status).toBe(204);
  });

  it("serves a TV only through its private code, plays the playlist in order, and the old code dies on a reset", async () => {
    const admin = await person("Zz Admin", true);
    const g = await god();
    const s = await screen(g, "Zz Bar TV");
    expect(s.code!.length).toBeGreaterThanOrEqual(43);
    expect(s.showQr).toBe(true);

    // No playlist yet: an empty feed with the screen's name.
    expect((await feed(s.code!)).json).toEqual({ screen: { name: "Zz Bar TV", showQr: true }, slides: [] });
    expect((await feed(s.code!)).status).toBe(200);

    const [row] = await db
      .insert(menuItems)
      .values([{ kind: "beer", section: "On tap", name: "Zz Hazy", style: "IPA", abv: "6%", available: true }, { kind: "beer", section: "On tap", name: "Zz Sold Out", style: "IPA", abv: "6%", available: false }])
      .returning();
    itemIds.push(row!.id);
    const p = await pool();
    await createEntry(p.id);
    const id = await playlist(admin, "Zz Evening", [
      { kind: "drinks", seconds: 20, enabled: true },
      { kind: "standings", poolId: p.id, seconds: 15, enabled: true },
      { kind: "music", seconds: 10, enabled: false },
      { kind: "kitchen", seconds: 10, enabled: true },
    ]);
    expect((await call(admin, "PATCH", `/tv/screens/${s.id}`, { playlistId: id, showQr: false })).status).toBe(204);

    const res = await feed(s.code!);
    expect((await app.inject({ method: "GET", url: `/public/tv/${s.code}` })).headers["cache-control"]).toBe("no-store");
    const body = res.json as TvFeed;
    expect(body.screen).toEqual({ name: "Zz Bar TV", showQr: false });
    expect(body.slides.map((x) => x.kind)).toEqual(["drinks", "standings", "kitchen"]); // the disabled music slide is left out
    const drinks = body.slides[0]!;
    expect(drinks.kind === "drinks" && drinks.content.flatMap((sec) => sec.items.map((i) => i.name))).toContain("Zz Hazy");
    // The pool's content is exactly what the signed-in TV page shows.
    const signedIn = await call(admin, "GET", `/pools/${p.id}/tv`);
    expect(body.slides[1]!.kind === "standings" && body.slides[1]!.content).toEqual(signedIn.json);
    // Nothing private: no email addresses anywhere in the feed.
    expect(res.body).not.toContain("@");

    // Deleting the pool takes its slide with it.
    await db.delete(pools).where(eq(pools.id, p.id));
    poolIds.splice(0);
    expect(((await feed(s.code!)).json as TvFeed).slides.map((x) => x.kind)).toEqual(["drinks", "kitchen"]);

    // Resetting the link kills the old code, keeps the settings, and the new code works.
    const oldCode = s.code!;
    expect((await call(g, "POST", `/tv/screens/${s.id}/reset-link`)).status).toBe(204);
    expect((await feed(oldCode)).status).toBe(404);
    const after = ((await call(g, "GET", "/tv")).json as AdminTv).screens.find((x) => x.id === s.id)!;
    expect(after.code).not.toBe(oldCode);
    expect(after).toMatchObject({ playlistId: id, showQr: false });
    expect((await feed(after.code!)).status).toBe(200);
  });

  it("answers a wrong code with a plain not found", async () => {
    for (const code of ["nope", "x".repeat(43), "a%2Fb", "x".repeat(80)]) {
      const res = await feed(code);
      expect(res.status).toBe(404);
      expect(res.json).toEqual({ error: "Not found" });
    }
    expect((await feed("x".repeat(300))).status).toBe(404); // too long even to match the route
  });

  it("records who did what in Activity, and never the private link", async () => {
    const admin = await person("Zz Admin", true);
    const g = await god();
    const s = await screen(g, "Zz Bar TV");
    const id = await playlist(admin, "Zz Holiday", [{ kind: "drinks", seconds: 15, enabled: true }]);
    await call(admin, "PATCH", `/tv/screens/${s.id}`, { playlistId: id });
    await call(admin, "PATCH", `/tv/screens/${s.id}`, { showQr: false });
    await call(g, "PATCH", `/tv/screens/${s.id}`, { name: "Zz Patio TV" });
    await call(g, "POST", `/tv/screens/${s.id}/reset-link`);
    await call(admin, "PATCH", `/tv/screens/${s.id}`, { playlistId: null });
    await call(admin, "DELETE", `/tv/playlists/${id}`);
    await call(g, "DELETE", `/tv/screens/${s.id}`);

    const rows = await db.select().from(adminActivity).where(inArray(adminActivity.actorId, [admin.id, g.id]));
    expect(rows.map((r) => r.kind).sort()).toEqual(
      ["tv_playlist_deleted", "tv_playlist_saved", "tv_screen_created", "tv_screen_deleted", "tv_screen_link_reset", "tv_screen_playlist_set", "tv_screen_playlist_set", "tv_screen_playlist_set", "tv_screen_renamed"].sort()
    );
    expect(rows.some((r) => r.summary.includes('set the TV screen "Zz Bar TV" to play "Zz Holiday"'))).toBe(true);
    expect(rows.some((r) => r.summary.includes("play nothing"))).toBe(true);
    for (const r of rows) expect(r.summary).not.toContain(s.code!);
  });

  it("limits screens and refuses a duplicate screen name", async () => {
    const g = await god();
    await screen(g, "Zz Bar TV");
    expect((await call(g, "POST", "/tv/screens", { name: "zz bar tv" })).status).toBe(409);
    expect((await call(g, "POST", "/tv/screens", { name: "" })).status).toBe(400);
  });
});
