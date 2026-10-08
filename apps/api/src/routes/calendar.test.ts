import { defaultSurvivorRulesConfig, addDays, easternToday, type AdminCalendar, type AdminCalendarEntryDetail, type PublicCalendar } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, calendarEntries, musicEvents } from "../db/schema.js";
import { cleanupFixtures, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, emailVerified: true });
const today = easternToday(new Date());
const inDays = (n: number) => addDays(today, n);

describe("the calendar", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const poolIds: string[] = [];
  const eventIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await db.delete(calendarEntries).where(like(calendarEntries.title, "Zz %"));
    if (eventIds.length > 0) await db.delete(musicEvents).where(inArray(musicEvents.id, eventIds.splice(0)));
    await cleanupFixtures(poolIds.splice(0), [], userIds.splice(0));
  });

  const person = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
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
  const add = async (admin: User, over: object = {}) => {
    const res = await call(admin, "POST", "/calendar/entries", { title: "Zz Trivia", date: inDays(1), type: "event", repeat: "none", ...over });
    expect(res.status, JSON.stringify(res.json)).toBe(201);
    return res.json.id as string;
  };
  const week = async (from?: string) => (await call(null, "GET", `/public/calendar${from ? `?from=${from}` : ""}`)).json as PublicCalendar;
  const titlesOn = (cal: PublicCalendar, date: string) => cal.days.find((d) => d.date === date)!.entries.map((e) => e.title);

  it("serves 7 days to anyone, with entries on their days and nothing private", async () => {
    const admin = await person("Zz Admin", true);
    await add(admin, { title: "Zz Taco Night", date: inDays(2), startTime: "17:00", note: "Two for one", link: { kind: "app", target: "kitchen" } });
    const res = await call(null, "GET", "/public/calendar");
    expect(res.status).toBe(200);
    const cal = res.json as PublicCalendar;
    expect(cal.today).toBe(today);
    expect(cal.days).toHaveLength(7);
    expect(cal.days.map((d) => d.date)).toEqual(Array.from({ length: 7 }, (_, i) => inDays(i)));
    const taco = cal.days[2]!.entries.find((e) => e.title === "Zz Taco Night")!;
    expect(taco).toMatchObject({ startTime: "17:00", note: "Two for one", type: "event", link: { href: "/menu/kitchen", external: false } });
    // Only public fields: no entry ids, no admin names, no emails.
    expect(Object.keys(taco).sort()).toEqual(["endTime", "key", "link", "note", "startTime", "title", "type"]);
    expect(res.body).not.toContain("@");
    expect((await app.inject({ method: "GET", url: "/public/calendar" })).headers["cache-control"]).toBe("no-store");
  });

  it("asks for another week, refuses a date too far away, and rejects nonsense", async () => {
    const admin = await person("Zz Admin", true);
    await add(admin, { title: "Zz Later", date: inDays(9) });
    expect(titlesOn(await week(inDays(7)), inDays(9))).toEqual(["Zz Later"]);
    expect((await call(null, "GET", `/public/calendar?from=${inDays(2000)}`)).status).toBe(400);
    expect((await call(null, "GET", "/public/calendar?from=2026-02-31")).status).toBe(400);
    expect((await call(null, "GET", "/public/calendar?from=soon")).status).toBe(400);
  });

  it("shows music events without a second entry, and an admin cannot change them here", async () => {
    const admin = await person("Zz Admin", true);
    const [m] = await db.insert(musicEvents).values({ title: "Zz The Band", eventDate: inDays(3), startTime: "20:00" }).returning();
    eventIds.push(m!.id);
    const cal = await week();
    const band = cal.days[3]!.entries.find((e) => e.title === "Zz The Band")!;
    expect(band).toMatchObject({ type: "music", startTime: "20:00" });
    const adminView = (await call(admin, "GET", "/calendar/entries")).json as AdminCalendar;
    expect(adminView.days[3]!.entries.find((e) => e.title === "Zz The Band")).toMatchObject({ fromMusic: true, entryId: null });
  });

  it("repeats an entry and changes or cancels one day without touching the others", async () => {
    const admin = await person("Zz Admin", true);
    const id = await add(admin, { title: "Zz Trivia", date: today, repeat: "weekly", startTime: "19:00", type: "event" });
    expect(titlesOn(await week(), today)).toEqual(["Zz Trivia"]);
    expect(titlesOn(await week(), inDays(1))).toEqual([]);
    expect(titlesOn(await week(inDays(7)), inDays(7))).toEqual(["Zz Trivia"]);

    // Change next week's only.
    const next = inDays(7);
    expect((await call(admin, "PUT", `/calendar/entries/${id}/days/${next}`, { title: "Zz Trivia finals", type: "event", startTime: "20:00" })).status).toBe(204);
    expect(titlesOn(await week(next), next)).toEqual(["Zz Trivia finals"]);
    expect(titlesOn(await week(), today)).toEqual(["Zz Trivia"]);
    expect(titlesOn(await week(inDays(14)), inDays(14))).toEqual(["Zz Trivia"]);

    // Cancel the one after.
    expect((await call(admin, "DELETE", `/calendar/entries/${id}/days/${inDays(14)}`)).status).toBe(204);
    expect(titlesOn(await week(inDays(14)), inDays(14))).toEqual([]);
    expect(titlesOn(await week(inDays(21)), inDays(21))).toEqual(["Zz Trivia"]);

    // Editing all keeps the days that were changed on their own.
    const edit = await call(admin, "PATCH", `/calendar/entries/${id}`, { title: "Zz Trivia night", date: today, type: "event", repeat: "weekly", startTime: "19:00" });
    expect(edit.status).toBe(204);
    expect(titlesOn(await week(), today)).toEqual(["Zz Trivia night"]);
    expect(titlesOn(await week(next), next)).toEqual(["Zz Trivia finals"]);
    expect(titlesOn(await week(inDays(14)), inDays(14))).toEqual([]);

    const detail = (await call(admin, "GET", `/calendar/entries/${id}`)).json as AdminCalendarEntryDetail;
    expect(detail).toMatchObject({ id, title: "Zz Trivia night", repeat: "weekly", cancelledDays: [inDays(14)] });
    expect(detail.changedDays).toEqual([{ date: next, title: "Zz Trivia finals", startTime: "20:00", endTime: null, type: "event", note: null, link: null }]);

    // Removing the series removes its one-day changes with it.
    expect((await call(admin, "DELETE", `/calendar/entries/${id}`)).status).toBe(204);
    expect(titlesOn(await week(next), next)).toEqual([]);
    expect((await call(admin, "GET", `/calendar/entries/${id}`)).status).toBe(404);
  });

  it("refuses a one-day change for a day the entry does not happen on, or for a one-off", async () => {
    const admin = await person("Zz Admin", true);
    const series = await add(admin, { date: today, repeat: "weekly" });
    const once = await add(admin, { title: "Zz Once", date: inDays(1) });
    const details = { title: "Zz X", type: "event" };
    expect((await call(admin, "PUT", `/calendar/entries/${series}/days/${inDays(1)}`, details)).status).toBe(400); // not a weekly day
    expect((await call(admin, "DELETE", `/calendar/entries/${series}/days/${inDays(1)}`)).status).toBe(400);
    expect((await call(admin, "PUT", `/calendar/entries/${series}/days/${addDays(today, -7)}`, details)).status).toBe(400); // before it began
    expect((await call(admin, "PUT", `/calendar/entries/${once}/days/${inDays(1)}`, details)).status).toBe(400); // a one-off
    expect((await call(admin, "PUT", `/calendar/entries/${series}/days/2026-02-31`, details)).status).toBe(400);
    expect((await call(admin, "PUT", `/calendar/entries/${crypto.randomUUID()}/days/${today}`, details)).status).toBe(404);
  });

  it("checks the fields, and refuses unsafe links", async () => {
    const admin = await person("Zz Admin", true);
    const post = (over: object) => call(admin, "POST", "/calendar/entries", { title: "Zz Check", date: inDays(1), type: "event", repeat: "none", ...over });
    expect((await post({ startTime: "20:00", endTime: "19:00" })).status).toBe(400);
    expect((await post({ title: "" })).status).toBe(400);
    expect((await post({ repeat: "daily" })).status).toBe(400);
    for (const target of ["javascript:alert(1)", "http://example.com", "/admin", "data:text/html,x"]) {
      expect((await post({ link: { kind: "url", target } })).status, target).toBe(400);
    }
    expect((await post({ link: { kind: "app", target: "/admin" } })).status).toBe(400);
    expect((await post({ link: { kind: "url", target: "https://example.com/tickets", label: "Get tickets" } })).status).toBe(201);
    const cal = await week();
    expect(cal.days[1]!.entries.find((e) => e.title === "Zz Check")!.link).toEqual({ href: "https://example.com/tickets", label: "Get tickets", external: true });
  });

  it("drops a link to a pool that has gone, and keeps the entry", async () => {
    const admin = await person("Zz Admin", true);
    const pool = await createPool("survivor", defaultSurvivorRulesConfig, 3810);
    poolIds.push(pool.id);
    await add(admin, { title: "Zz Join us", date: inDays(1), link: { kind: "app", target: `pool:${pool.id}` } });
    expect((await week()).days[1]!.entries.find((e) => e.title === "Zz Join us")!.link).toMatchObject({ href: `/join/${pool.id}` });
    await cleanupFixtures(poolIds.splice(0), [], []);
    const after = (await week()).days[1]!.entries.find((e) => e.title === "Zz Join us")!;
    expect(after.link).toBeNull();
  });

  it("refuses signed-out callers and players on every admin route, and records every admin write", async () => {
    const admin = await person("Zz Admin", true);
    const player = await person("Zz Player");
    const id = await add(admin, { date: today, repeat: "weekly" });
    const body = { title: "Zz Nope", date: inDays(1), type: "event", repeat: "none" };
    for (const [who, code] of [[null, 401], [player, 403]] as const) {
      expect((await call(who, "GET", "/calendar/entries")).status).toBe(code);
      expect((await call(who, "GET", `/calendar/entries/${id}`)).status).toBe(code);
      expect((await call(who, "POST", "/calendar/entries", body)).status).toBe(code);
      expect((await call(who, "PATCH", `/calendar/entries/${id}`, body)).status).toBe(code);
      expect((await call(who, "DELETE", `/calendar/entries/${id}`)).status).toBe(code);
      expect((await call(who, "PUT", `/calendar/entries/${id}/days/${today}`, { title: "Zz Nope", type: "event" })).status).toBe(code);
      expect((await call(who, "DELETE", `/calendar/entries/${id}/days/${today}`)).status).toBe(code);
    }
    await call(admin, "PUT", `/calendar/entries/${id}/days/${inDays(7)}`, { title: "Zz Special", type: "event" });
    await call(admin, "DELETE", `/calendar/entries/${id}/days/${inDays(14)}`);
    await call(admin, "PATCH", `/calendar/entries/${id}`, { title: "Zz Trivia", date: today, type: "event", repeat: "weekly" });
    await call(admin, "DELETE", `/calendar/entries/${id}`);
    const rows = await db.select().from(adminActivity).where(eq(adminActivity.actorId, admin.id));
    expect(rows.map((r) => r.kind).sort()).toEqual(["calendar_day_cancelled", "calendar_day_changed", "calendar_entry_added", "calendar_entry_changed", "calendar_entry_removed"]);
    expect(rows.find((r) => r.kind === "calendar_day_cancelled")!.summary).toContain("only");
    // Nothing the players did was recorded.
    expect(await db.select().from(adminActivity).where(eq(adminActivity.actorId, player.id))).toHaveLength(0);
  });
});
