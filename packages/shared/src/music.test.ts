import { describe, expect, it } from "vitest";
import {
  addDays,
  bucketOf,
  createMusicEventSchema,
  easternToday,
  formatEventDay,
  formatEventTime,
  isRealDate,
  nextWeekendDates,
  weekdayOf,
  weekendWindow,
} from "./music.js";

// 2026-10-09 is a Friday.
describe("weekendWindow", () => {
  it.each([
    ["2026-10-05", "2026-10-09", "2026-10-11"], // Monday: the coming weekend
    ["2026-10-08", "2026-10-09", "2026-10-11"], // Thursday
    ["2026-10-09", "2026-10-09", "2026-10-11"], // Friday
    ["2026-10-10", "2026-10-10", "2026-10-11"], // Saturday: Friday has gone
    ["2026-10-11", "2026-10-11", "2026-10-11"], // Sunday: only today is left
  ])("%s", (today, start, end) => {
    expect(weekendWindow(today)).toEqual({ start, end });
  });
});

describe("bucketOf", () => {
  it("sorts a date into past, this weekend or coming up", () => {
    const today = "2026-10-07"; // Wednesday
    expect(bucketOf("2026-10-06", today)).toBe("past");
    expect(bucketOf("2026-10-07", today)).toBe("comingUp"); // a Wednesday event is not the weekend
    expect(bucketOf("2026-10-09", today)).toBe("thisWeekend");
    expect(bucketOf("2026-10-11", today)).toBe("thisWeekend");
    expect(bucketOf("2026-10-12", today)).toBe("comingUp");
    expect(bucketOf("2026-10-16", today)).toBe("comingUp");
  });
  it("drops days of the weekend that are already gone", () => {
    expect(bucketOf("2026-10-09", "2026-10-10")).toBe("past");
    expect(bucketOf("2026-10-10", "2026-10-10")).toBe("thisWeekend");
  });
});

describe("dates", () => {
  it("adds days across months and reports weekdays", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(weekdayOf("2026-10-09")).toBe(5);
    expect(weekdayOf("2026-10-11")).toBe(0);
  });
  it("knows a real date from an impossible one", () => {
    expect(isRealDate("2026-10-09")).toBe(true);
    for (const bad of ["2026-02-31", "2026-13-01", "2026-1-9", "tomorrow", ""]) expect(isRealDate(bad), bad).toBe(false);
  });
  it("uses Eastern time for today, not UTC", () => {
    // 02:30 UTC on the 10th is still the evening of the 9th in Toronto.
    expect(easternToday(new Date("2026-10-10T02:30:00Z"))).toBe("2026-10-09");
    expect(easternToday(new Date("2026-10-10T05:00:00Z"))).toBe("2026-10-10");
  });
  it("offers the weekend days still to come", () => {
    expect(nextWeekendDates("2026-10-07")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(nextWeekendDates("2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]);
  });
});

describe("formatting", () => {
  it("shows times the way the brewery says them", () => {
    expect(formatEventTime("13:00", "16:00")).toBe("1 – 4 PM");
    expect(formatEventTime("11:30", "13:00")).toBe("11:30 AM – 1 PM");
    expect(formatEventTime("19:00", null)).toBe("7 PM");
    expect(formatEventTime("16:00", "19:00")).toBe("4 – 7 PM");
    expect(formatEventTime(null, null)).toBe("Time to be confirmed");
  });
  it("shows the day", () => {
    expect(formatEventDay("2026-10-09")).toBe("Fri 9");
  });
});

describe("createMusicEventSchema", () => {
  const ok = { title: "Bradley McAree", date: "2026-10-10" };
  it("accepts a title and a date alone", () => {
    expect(createMusicEventSchema.parse(ok)).toEqual({ ...ok, startTime: null, endTime: null });
  });
  it("refuses bad input", () => {
    const bad = [
      { ...ok, title: "" },
      { ...ok, title: "x".repeat(81) },
      { ...ok, date: "2026-02-31" },
      { ...ok, startTime: "1pm" },
      { ...ok, startTime: "24:00" },
      { ...ok, endTime: "16:00" },
      { ...ok, startTime: "16:00", endTime: "13:00" },
      { ...ok, startTime: "16:00", endTime: "16:00" },
      { ...ok, extra: 1 },
    ];
    for (const b of bad) expect(createMusicEventSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });
});
