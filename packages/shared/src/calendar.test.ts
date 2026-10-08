import { describe, expect, it } from "vitest";
import {
  capEntries,
  calendarDayHeading,
  calendarFromAllowed,
  dayDetailsSchema,
  entrySchema,
  linkSchema,
  occurrencesForRange,
  occursOn,
  resolveLink,
  type EntryRow,
  type ExceptionRow,
} from "./calendar.js";

const entry = (over: Partial<EntryRow> = {}): EntryRow => ({
  id: "e1",
  date: "2026-10-06",
  title: "Trivia",
  startTime: null,
  endTime: null,
  type: "event",
  note: null,
  link: null,
  repeat: "none",
  repeatUntil: null,
  ...over,
});
const dates = (e: Pick<EntryRow, "date" | "repeat" | "repeatUntil">, from: string, days: number) =>
  occurrencesForRange({ entries: [{ ...entry(), ...e }], exceptions: [], music: [] }, from, days)
    .filter((d) => d.entries.length > 0)
    .map((d) => d.date);

describe("repeat rules", () => {
  it("a one-off happens on its day only", () => {
    expect(dates({ date: "2026-10-06", repeat: "none", repeatUntil: null }, "2026-10-01", 14)).toEqual(["2026-10-06"]);
  });

  it("every week: the same weekday from the first day on, and never before it", () => {
    // 2026-10-06 is a Tuesday.
    expect(dates({ date: "2026-10-06", repeat: "weekly", repeatUntil: null }, "2026-09-29", 22)).toEqual(["2026-10-06", "2026-10-13", "2026-10-20"]);
  });

  it("every 2 weeks: the 3rd, 17th and 31st but not the weeks between, across a month end", () => {
    expect(dates({ date: "2026-10-03", repeat: "biweekly", repeatUntil: null }, "2026-10-01", 50)).toEqual(["2026-10-03", "2026-10-17", "2026-10-31", "2026-11-14"]);
  });

  it("monthly on the same weekday: the 2nd Friday of each month", () => {
    // 2026-10-09 is the 2nd Friday of October.
    const e = { date: "2026-10-09", repeat: "monthly_weekday" as const, repeatUntil: null };
    expect(dates(e, "2026-10-01", 100)).toEqual(["2026-10-09", "2026-11-13", "2026-12-11", "2027-01-08"]);
    expect(occursOn(e, "2026-10-16")).toBe(false); // the 3rd Friday
    expect(occursOn(e, "2026-10-02")).toBe(false); // before the first day
  });

  it("monthly on a 5th weekday happens only in months that have one", () => {
    // 2026-10-30 is the 5th Friday of October. November 2026 has four Fridays; January 2027 has five.
    const e = { date: "2026-10-30", repeat: "monthly_weekday" as const, repeatUntil: null };
    expect(dates(e, "2026-10-01", 130)).toEqual(["2026-10-30", "2027-01-29"]);
  });

  it("goes through month ends, year ends, a leap day and the daylight saving weekends unchanged", () => {
    // 2028 is a leap year. 2028-02-29 is a Tuesday.
    expect(dates({ date: "2028-02-15", repeat: "weekly", repeatUntil: null }, "2028-02-01", 44)).toEqual(["2028-02-15", "2028-02-22", "2028-02-29", "2028-03-07", "2028-03-14"]);
    // Across New Year.
    expect(dates({ date: "2026-12-29", repeat: "weekly", repeatUntil: null }, "2026-12-28", 16)).toEqual(["2026-12-29", "2027-01-05", "2027-01-12"]);
    // Eastern clocks change on 2026-03-08 and 2026-11-01: a weekly Sunday entry still lands on every Sunday.
    expect(dates({ date: "2026-03-01", repeat: "weekly", repeatUntil: null }, "2026-03-01", 21)).toEqual(["2026-03-01", "2026-03-08", "2026-03-15"]);
    expect(dates({ date: "2026-10-25", repeat: "weekly", repeatUntil: null }, "2026-10-25", 21)).toEqual(["2026-10-25", "2026-11-01", "2026-11-08"]);
  });

  it("an end date is the last day, inclusive", () => {
    expect(dates({ date: "2026-10-06", repeat: "weekly", repeatUntil: "2026-10-13" }, "2026-10-01", 30)).toEqual(["2026-10-06", "2026-10-13"]);
  });
});

describe("one day of a series", () => {
  const series = entry({ id: "s", title: "Trivia", repeat: "weekly", startTime: "19:00", type: "event", note: "Teams of 4" });
  const exception = (over: Partial<ExceptionRow>): ExceptionRow => ({
    entryId: "s",
    date: "2026-10-13",
    cancelled: false,
    title: null,
    startTime: null,
    endTime: null,
    type: null,
    note: null,
    link: null,
    ...over,
  });
  const week = (exceptions: ExceptionRow[]) => occurrencesForRange({ entries: [series], exceptions, music: [] }, "2026-10-06", 14);

  it("a cancelled day vanishes and the other days stay", () => {
    const days = week([exception({ cancelled: true })]);
    expect(days.filter((d) => d.entries.length > 0).map((d) => d.date)).toEqual(["2026-10-06"]);
  });

  it("a changed day carries its own details and is marked, and the others keep the series", () => {
    const days = week([exception({ title: "Trivia: finals", startTime: "20:00", type: "event", note: null })]);
    const changed = days.find((d) => d.date === "2026-10-13")!.entries[0]!;
    expect(changed).toMatchObject({ title: "Trivia: finals", startTime: "20:00", note: null, changedDay: true, repeats: true });
    const normal = days.find((d) => d.date === "2026-10-06")!.entries[0]!;
    expect(normal).toMatchObject({ title: "Trivia", startTime: "19:00", note: "Teams of 4", changedDay: false });
  });

  it("a change for a day the series does not happen on is ignored", () => {
    const days = week([exception({ date: "2026-10-14", title: "Ghost" })]);
    expect(days.flatMap((d) => d.entries).map((e) => e.title)).toEqual(["Trivia", "Trivia"]);
  });
});

describe("music and ordering", () => {
  it("music events appear as Music entries without being entered twice, and all-day comes first, then by time", () => {
    const days = occurrencesForRange(
      {
        entries: [
          entry({ id: "a", title: "Zebra special", startTime: "17:00" }),
          entry({ id: "b", title: "Brewery tour", startTime: null }),
          entry({ id: "c", title: "Early bird", startTime: "11:30" }),
        ],
        exceptions: [],
        music: [{ id: "m1", title: "The Band", date: "2026-10-06", startTime: "20:00", endTime: "23:00" }],
      },
      "2026-10-06",
      1
    );
    expect(days[0]!.entries.map((e) => e.title)).toEqual(["Brewery tour", "Early bird", "Zebra special", "The Band"]);
    const band = days[0]!.entries.at(-1)!;
    expect(band).toMatchObject({ type: "music", fromMusic: true, entryId: null, endTime: "23:00" });
  });

  it("gives exactly the days asked for, empty days included", () => {
    const days = occurrencesForRange({ entries: [], exceptions: [], music: [] }, "2026-10-07", 7);
    expect(days.map((d) => d.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(days.every((d) => d.entries.length === 0)).toBe(true);
  });
});

describe("what an admin types", () => {
  const base = { title: "Taco Tuesday", date: "2026-10-06", type: "food", repeat: "weekly" } as const;

  it("accepts a good entry and refuses bad ones", () => {
    expect(entrySchema.safeParse({ ...base, startTime: "17:00", endTime: "21:00", note: "Two for one" }).success).toBe(true);
    const bad = (over: object) => entrySchema.safeParse({ ...base, ...over }).success;
    expect(bad({ title: "" })).toBe(false);
    expect(bad({ title: "x".repeat(81) })).toBe(false);
    expect(bad({ date: "2026-02-31" })).toBe(false);
    expect(bad({ startTime: "9am" })).toBe(false);
    expect(bad({ startTime: "20:00", endTime: "19:00" })).toBe(false); // end before start
    expect(bad({ endTime: "19:00" })).toBe(false); // an end with no start
    expect(bad({ repeatUntil: "2026-10-01" })).toBe(false);
    expect(bad({ repeat: "daily" })).toBe(false);
    expect(bad({ type: "party" })).toBe(false);
    expect(bad({ note: "x".repeat(301) })).toBe(false);
    expect(bad({ extra: 1 })).toBe(false);
  });

  it("checks one day's details the same way", () => {
    expect(dayDetailsSchema.safeParse({ title: "Trivia: finals", type: "event", startTime: "20:00" }).success).toBe(true);
    expect(dayDetailsSchema.safeParse({ title: "Trivia", type: "event", startTime: "20:00", endTime: "19:00" }).success).toBe(false);
  });
});

describe("links are safe", () => {
  const ok = (l: object) => linkSchema.safeParse(l).success;
  it("allows the app pages, a pool, and https addresses only", () => {
    expect(ok({ kind: "app", target: "menu" })).toBe(true);
    expect(ok({ kind: "app", target: "pool:11111111-1111-4111-8111-111111111111", label: "Join" })).toBe(true);
    expect(ok({ kind: "url", target: "https://example.com/tickets" })).toBe(true);
  });
  it("refuses scripts, plain http, relative paths, credentials and unknown pages", () => {
    for (const target of ["javascript:alert(1)", "http://example.com", "//example.com", "/admin", "https://", "https://user:pw@example.com", "data:text/html,hi", "https://localhost"])
      expect(ok({ kind: "url", target }), target).toBe(false);
    expect(ok({ kind: "app", target: "/admin" })).toBe(false);
    expect(ok({ kind: "app", target: "admin" })).toBe(false);
    expect(ok({ kind: "app", target: "pool:nope" })).toBe(false);
    expect(ok({ kind: "url", target: "https://example.com", label: "x".repeat(31) })).toBe(false);
  });
  it("resolves links to something to click, and drops a link to a pool that is gone", () => {
    const exists = (id: string) => id === "11111111-1111-4111-8111-111111111111";
    expect(resolveLink({ kind: "app", target: "kitchen", label: null }, exists)).toEqual({ href: "/menu/kitchen", label: "See the kitchen menu", external: false });
    expect(resolveLink({ kind: "app", target: "menu", label: "Our drinks" }, exists)).toMatchObject({ label: "Our drinks" });
    expect(resolveLink({ kind: "url", target: "https://example.com/x", label: null }, exists)).toEqual({ href: "https://example.com/x", label: "Learn more", external: true });
    expect(resolveLink({ kind: "app", target: "pool:11111111-1111-4111-8111-111111111111", label: null }, exists)).toMatchObject({ href: "/join/11111111-1111-4111-8111-111111111111" });
    expect(resolveLink({ kind: "app", target: "pool:22222222-2222-4222-8222-222222222222", label: null }, exists)).toBeNull();
    expect(resolveLink({ kind: "url", target: "javascript:alert(1)", label: null }, exists)).toBeNull();
    expect(resolveLink(null, exists)).toBeNull();
  });
});

describe("helpers", () => {
  it("limits how far from today a week may be asked for, and names days", () => {
    expect(calendarFromAllowed("2026-10-07", "2026-10-07")).toBe(true);
    expect(calendarFromAllowed("2028-10-01", "2026-10-07")).toBe(true);
    expect(calendarFromAllowed("2030-01-01", "2026-10-07")).toBe(false);
    expect(calendarFromAllowed("2026-13-01", "2026-10-07")).toBe(false);
    const long = (d: string) => `long ${d}`;
    expect([calendarDayHeading("2026-10-07", "2026-10-07", long), calendarDayHeading("2026-10-08", "2026-10-07", long), calendarDayHeading("2026-10-09", "2026-10-07", long)]).toEqual(["Today", "Tomorrow", "long 2026-10-09"]);
  });
});

describe("capping a TV day card", () => {
  it("shows up to four and counts the rest", () => {
    expect(capEntries([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(capEntries([1, 2, 3, 4])).toEqual({ shown: [1, 2, 3, 4], more: 0 });
    expect(capEntries([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3, 4], more: 2 });
    expect(capEntries([])).toEqual({ shown: [], more: 0 });
  });
});
