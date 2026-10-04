import { describe, expect, it } from "vitest";
import { ACTIVITY_CATEGORIES, ACTIVITY_KINDS, kindsForFilter } from "./admin-activity.js";
import { formatActivityTime } from "./game-time.js";

describe("activity kinds", () => {
  it("gives every kind a title and a known category", () => {
    for (const [kind, info] of Object.entries(ACTIVITY_KINDS)) {
      expect(info.title.length, kind).toBeGreaterThan(3);
      expect(ACTIVITY_CATEGORIES).toContain(info.category);
    }
  });

  it("the Standings filter covers results, wipeouts, players and pool changes but not announcements", () => {
    const kinds = kindsForFilter("standings");
    for (const k of ["result_entered", "result_changed", "wipeout_resolved", "player_status_changed", "player_added", "pool_locked"]) {
      expect(kinds).toContain(k);
    }
    expect(kinds).not.toContain("promotion_created");
  });

  it("the Menu filter shows the four menu kinds", () => {
    expect(kindsForFilter("menu").sort()).toEqual(["menu_item_added", "menu_item_availability_changed", "menu_item_changed", "menu_item_removed"]);
  });
});

describe("formatActivityTime", () => {
  // Now: Sunday 2026-10-04 21:30 UTC = 5:30 PM Eastern.
  const now = "2026-10-04T21:30:00.000Z";
  it("says Today and Yesterday on the Eastern calendar", () => {
    expect(formatActivityTime("2026-10-04T21:04:00.000Z", now)).toBe("Today · 5:04 PM");
    expect(formatActivityTime("2026-10-03T22:40:00.000Z", now)).toBe("Yesterday · 6:40 PM");
  });
  it("uses the weekday within the last week and the date after that", () => {
    expect(formatActivityTime("2026-09-28T13:15:00.000Z", now)).toBe("Mon · 9:15 AM");
    expect(formatActivityTime("2026-09-20T13:15:00.000Z", now)).toBe("Sep 20 · 9:15 AM");
  });
  it("counts a late-evening Eastern event as that Eastern day even when it is already tomorrow in UTC", () => {
    // 2026-10-05 01:30 UTC is 9:30 PM Sunday Eastern: Today at 5:30 PM Sunday.
    expect(formatActivityTime("2026-10-05T01:30:00.000Z", "2026-10-05T02:00:00.000Z")).toBe("Today · 9:30 PM");
  });
});
