import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { addDays, easternToday, type AdminMusic, type MusicEvent, type PublicMusic } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity, musicEvents } from "../db/schema.js";
import { cleanupFixtures, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

const today = easternToday(new Date());
const ahead = (days: number) => addDays(today, days);

describe("the music list", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const eventIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    if (eventIds.length > 0) await db.delete(musicEvents).where(inArray(musicEvents.id, eventIds.splice(0)));
    await cleanupFixtures([], [], userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const send = (method: "POST" | "PATCH" | "GET" | "DELETE", url: string, payload?: object) => app.inject({ method, url, payload });
  const add = async (payload: object) => {
    const res = await send("POST", "/music/events", payload);
    if (res.statusCode === 201) eventIds.push((res.json() as MusicEvent).id);
    return res;
  };
  const records = (u: User) => db.select().from(adminActivity).where(eq(adminActivity.actorId, u.id));
  const titles = (events: MusicEvent[]) => events.map((e) => e.title);

  describe("reading", () => {
    it("needs no sign-in, hides past events, and sorts what is left into this weekend and coming up", async () => {
      actAs(as(await person("Music Admin", true)));
      await add({ title: "Zz Past Band", date: ahead(-3) });
      await add({ title: "Zz Far Band", date: ahead(30), startTime: "19:00" });
      await add({ title: "Zz Late Band", date: ahead(31), startTime: "20:00" });
      await add({ title: "Zz Early Band", date: ahead(31), startTime: "13:00", endTime: "16:00" });

      actAs(null);
      const res = await send("GET", "/public/music");
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toContain("must-revalidate");
      const music = res.json() as PublicMusic;
      const all = [...music.thisWeekend, ...music.comingUp];
      expect(titles(all)).not.toContain("Zz Past Band");
      // Same day: ordered by start time.
      const mine = titles(music.comingUp).filter((t) => t.startsWith("Zz"));
      expect(mine).toEqual(["Zz Far Band", "Zz Early Band", "Zz Late Band"]);
      expect(music.comingUp.find((e) => e.title === "Zz Early Band")).toMatchObject({ date: ahead(31), startTime: "13:00", endTime: "16:00" });
    });

    it("an event with no times has none, and nothing private is sent", async () => {
      const admin = await person("Music Admin", true);
      actAs(as(admin));
      await add({ title: "Zz Band To Be Announced", date: ahead(40) });
      actAs(null);
      const res = await send("GET", "/public/music");
      const event = (res.json() as PublicMusic).comingUp.find((e) => e.title === "Zz Band To Be Announced");
      expect(event).toMatchObject({ startTime: null, endTime: null });
      expect(res.body).not.toContain(admin.email);
      expect(res.body).not.toContain(admin.id);
    });
  });

  describe("changing", () => {
    it("refuses signed-out callers and players on every write, and changes nothing", async () => {
      const admin = await person("Music Admin", true);
      const player = await person("Music Player");
      actAs(as(admin));
      const id = ((await add({ title: "Zz Locked Band", date: ahead(20) })).json() as MusicEvent).id;
      for (const [who, code] of [
        [null, 401],
        [as(player), 403],
      ] as const) {
        actAs(who);
        expect((await send("GET", "/music/events")).statusCode).toBe(code);
        expect((await send("POST", "/music/events", { title: "Nope", date: ahead(5) })).statusCode).toBe(code);
        expect((await send("PATCH", `/music/events/${id}`, { title: "Nope", date: ahead(5) })).statusCode).toBe(code);
        expect((await send("DELETE", `/music/events/${id}`)).statusCode).toBe(code);
      }
      expect(await db.query.musicEvents.findFirst({ where: eq(musicEvents.id, id) })).toMatchObject({ title: "Zz Locked Band" });
    });

    it("accepts a title and a date alone, and refuses bad input", async () => {
      actAs(as(await person("Music Admin", true)));
      expect((await add({ title: "Zz Plain", date: ahead(10) })).statusCode).toBe(201);
      const bad: object[] = [
        {},
        { title: "Zz", date: "2026-02-31" },
        { title: "", date: ahead(10) },
        { title: "x".repeat(81), date: ahead(10) },
        { title: "Zz", date: ahead(10), startTime: "9am" },
        { title: "Zz", date: ahead(10), endTime: "16:00" },
        { title: "Zz", date: ahead(10), startTime: "16:00", endTime: "15:00" },
        { title: "Zz", date: ahead(10), extra: true },
      ];
      for (const payload of bad) expect((await send("POST", "/music/events", payload)).statusCode, JSON.stringify(payload)).toBe(400);
    });

    it("edits an event and the public list shows the change; a missing event is 404", async () => {
      actAs(as(await person("Music Admin", true)));
      const id = ((await add({ title: "Zz Edit Me", date: ahead(25) })).json() as MusicEvent).id;
      const res = await send("PATCH", `/music/events/${id}`, { title: "Zz Edited", date: ahead(26), startTime: "16:00", endTime: "19:00" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ title: "Zz Edited", date: ahead(26), startTime: "16:00", endTime: "19:00" });
      expect((await send("PATCH", `/music/events/${crypto.randomUUID()}`, { title: "Zz", date: ahead(5) })).statusCode).toBe(404);
      actAs(null);
      const music = (await send("GET", "/public/music")).json() as PublicMusic;
      expect(titles([...music.thisWeekend, ...music.comingUp])).toContain("Zz Edited");
    });

    it("removing is permanent", async () => {
      actAs(as(await person("Music Admin", true)));
      const id = ((await add({ title: "Zz Gone", date: ahead(22) })).json() as MusicEvent).id;
      expect((await send("DELETE", `/music/events/${id}`)).statusCode).toBe(204);
      expect((await send("DELETE", `/music/events/${id}`)).statusCode).toBe(404);
    });

    it("the admin list has coming up and past, past newest first", async () => {
      actAs(as(await person("Music Admin", true)));
      await add({ title: "Zz Old One", date: ahead(-20) });
      await add({ title: "Zz Old Two", date: ahead(-10) });
      await add({ title: "Zz Upcoming", date: ahead(15) });
      const admin = (await send("GET", "/music/events")).json() as AdminMusic;
      expect(titles(admin.comingUp)).toContain("Zz Upcoming");
      const past = titles(admin.past).filter((t) => t.startsWith("Zz Old"));
      expect(past).toEqual(["Zz Old Two", "Zz Old One"]);
    });

    it("records each change in Activity with who made it", async () => {
      const admin = await person("Music Admin", true);
      actAs(as(admin));
      const id = ((await add({ title: "Zz Logged", date: ahead(12) })).json() as MusicEvent).id;
      await send("PATCH", `/music/events/${id}`, { title: "Zz Logged", date: ahead(13) });
      await send("DELETE", `/music/events/${id}`);
      const rows = await records(admin);
      expect(rows.map((r) => r.kind).sort()).toEqual(["music_event_added", "music_event_changed", "music_event_removed"]);
      expect(rows.every((r) => r.actorName === "Music Admin" && r.affectsOwnEntry === false)).toBe(true);
    });
  });
});
