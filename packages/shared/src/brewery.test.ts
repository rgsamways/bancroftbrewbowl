import { describe, expect, it } from "vitest";
import { createAnnouncementSchema, createFeatureSchema, createSpecialSchema, scheduleText, specialIsOver, specialShowsOn } from "./brewery.js";

describe("scheduleText", () => {
  it("reads like the brewery says it", () => {
    expect(scheduleText({ days: [0], date: null, startTime: "13:00", endTime: "16:00" })).toBe("Sundays, 1 – 4 PM");
    expect(scheduleText({ days: [5, 6], date: null, startTime: null, endTime: null })).toBe("Fridays and Saturdays");
    expect(scheduleText({ days: [0, 1, 3], date: null, startTime: "17:00", endTime: null })).toBe("Mondays, Wednesdays and Sundays, 5 PM");
    expect(scheduleText({ days: [0, 1, 2, 3, 4, 5, 6], date: null, startTime: null, endTime: null })).toBe("Every day");
    expect(scheduleText({ days: null, date: "2026-10-10", startTime: "19:00", endTime: null })).toBe("Sat Oct 10, 7 PM");
  });
});

describe("which day a special is on", () => {
  // 2026-10-11 is a Sunday.
  it("matches the weekday for a weekly special and the date for a one-day special", () => {
    expect(specialShowsOn({ days: [0], date: null }, "2026-10-11")).toBe(true);
    expect(specialShowsOn({ days: [0], date: null }, "2026-10-12")).toBe(false);
    expect(specialShowsOn({ days: null, date: "2026-10-11" }, "2026-10-11")).toBe(true);
    expect(specialShowsOn({ days: null, date: "2026-10-11" }, "2026-10-18")).toBe(false);
  });
  it("knows a one-day special is over, and a weekly one never is", () => {
    expect(specialIsOver({ date: "2026-10-10" }, "2026-10-11")).toBe(true);
    expect(specialIsOver({ date: "2026-10-11" }, "2026-10-11")).toBe(false);
    expect(specialIsOver({ date: null }, "2026-10-11")).toBe(false);
  });
});

describe("schemas", () => {
  const special = { title: "Sunday football: wings and nachos", days: [0], startTime: "13:00", endTime: "16:00" };
  it("accepts a good special and tidies it", () => {
    expect(createSpecialSchema.parse({ ...special, days: [0, 0], details: "" })).toMatchObject({ days: [0], details: null, tag: null, date: null });
    expect(createSpecialSchema.parse({ title: "One night", date: "2026-10-30" })).toMatchObject({ days: null, date: "2026-10-30" });
  });
  it("refuses a bad special", () => {
    const bad = [
      { title: "No when" },
      { ...special, date: "2026-10-30" },
      { ...special, title: "" },
      { ...special, title: "x".repeat(81) },
      { ...special, details: "x".repeat(201) },
      { ...special, days: [7] },
      { ...special, tag: "bogus" },
      { ...special, startTime: null, endTime: "16:00" },
      { ...special, startTime: "16:00", endTime: "13:00" },
      { title: "x", date: "2026-02-31" },
    ];
    for (const b of bad) expect(createSpecialSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });
  it("checks announcements and features", () => {
    expect(createAnnouncementSchema.safeParse({ title: "Watch with us", message: "Come in", weekNumber: 5 }).success).toBe(true);
    for (const b of [{ title: "", message: "x", weekNumber: 5 }, { title: "x", message: "x".repeat(301), weekNumber: 5 }, { title: "x", message: "x", weekNumber: 23 }, { title: "x", message: "x", weekNumber: 0 }])
      expect(createAnnouncementSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
    expect(createFeatureSchema.safeParse({ menuItemId: crypto.randomUUID(), scope: "week" }).success).toBe(true);
    expect(createFeatureSchema.safeParse({ menuItemId: "nope", scope: "week" }).success).toBe(false);
    expect(createFeatureSchema.safeParse({ menuItemId: crypto.randomUUID(), scope: "forever" }).success).toBe(false);
  });
});
