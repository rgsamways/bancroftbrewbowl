import { describe, expect, it } from "vitest";
import {
  createScreenSchema,
  menuPageAt,
  menuPagesOf,
  slideDurationMs,
  nextSlideIndex,
  pageSeconds,
  paginateMenu,
  playlistInputSchema,
  slideHasContent,
  updateScreenSchema,
  type TvFeedSlide,
} from "./tv-screens.js";
import type { MenuItem, MenuSection } from "./menu.js";
import type { PoolTv } from "./tv-recap.js";

const POOL = "11111111-1111-4111-8111-111111111111";
const item = (name: string, available = true): MenuItem => ({
  id: name,
  kind: "dish",
  section: "x",
  name,
  style: null,
  abv: null,
  description: null,
  priceCents: null,
  options: [],
  labels: [],
  available,
});
const section = (name: string, count: number, soldOut = 0): MenuSection => ({
  name,
  items: Array.from({ length: count }, (_, i) => item(`${name} ${i + 1}`, i >= soldOut)),
});

describe("playlist and screen schemas", () => {
  it("accepts a playlist and refuses bad slides", () => {
    const ok = { name: "Game day", slides: [{ kind: "standings", poolId: POOL, seconds: 15, enabled: true }, { kind: "drinks", seconds: 20, enabled: false }] };
    expect(playlistInputSchema.safeParse(ok).success).toBe(true);
    const bad = (slide: object) => playlistInputSchema.safeParse({ name: "x", slides: [slide] }).success;
    expect(bad({ kind: "standings", seconds: 15, enabled: true })).toBe(false); // no pool
    expect(bad({ kind: "drinks", poolId: POOL, seconds: 15, enabled: true })).toBe(false); // pool on a menu slide
    expect(bad({ kind: "drinks", seconds: 4, enabled: true })).toBe(false);
    expect(bad({ kind: "drinks", seconds: 121, enabled: true })).toBe(false);
    expect(bad({ kind: "calendar", seconds: 15, enabled: true })).toBe(true);
    expect(bad({ kind: "weather", seconds: 15, enabled: true })).toBe(false); // not a kind
    expect(bad({ kind: "drinks", seconds: 15, enabled: true, extra: 1 })).toBe(false);
    expect(playlistInputSchema.safeParse({ name: "", slides: [] }).success).toBe(false);
    expect(playlistInputSchema.safeParse({ name: "x", slides: Array(13).fill({ kind: "music", seconds: 15, enabled: true }) }).success).toBe(false);
  });

  it("checks screen names and changes", () => {
    expect(createScreenSchema.safeParse({ name: "Bar TV" }).success).toBe(true);
    expect(createScreenSchema.safeParse({ name: " " }).success).toBe(false);
    expect(updateScreenSchema.safeParse({ playlistId: null }).success).toBe(true);
    expect(updateScreenSchema.safeParse({ showQr: false }).success).toBe(true);
    expect(updateScreenSchema.safeParse({}).success).toBe(false);
    expect(updateScreenSchema.safeParse({ playlistId: "nope" }).success).toBe(false);
  });
});

describe("paginateMenu", () => {
  const rows = (pages: ReturnType<typeof paginateMenu>) => pages.map((p) => p.columns.map((c) => c.map((r) => (r.type === "heading" ? `#${r.name}${r.continued ? "+" : ""}` : r.item.name))));

  it("fits a short menu on one page, leaves out sold-out items and empty sections", () => {
    const pages = paginateMenu([section("Starters", 3, 1), section("Empty", 2, 2), section("Mains", 2)], 10);
    expect(pages).toHaveLength(1);
    expect(rows(pages)[0]).toEqual([["#Starters", "Starters 2", "Starters 3", "#Mains", "Mains 1", "Mains 2"], []].filter((c) => c.length > 0));
  });

  it("never ends a column on a heading, repeats the heading of a section that carries over, and fills pages in order", () => {
    const pages = paginateMenu([section("A", 4), section("B", 6)], 5);
    for (const p of pages)
      for (const c of p.columns) {
        expect(c.length).toBeLessThanOrEqual(5);
        if (c.length > 0) expect(c[c.length - 1]!.type).toBe("item");
      }
    const flat = rows(pages).flat(2);
    expect(flat.filter((x) => !x.startsWith("#"))).toEqual([...Array.from({ length: 4 }, (_, i) => `A ${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `B ${i + 1}`)]);
    expect(flat).toContain("#B+");
    expect(pages.length).toBeGreaterThan(1);
  });

  it("gives an empty menu no pages", () => {
    expect(paginateMenu([], 10)).toEqual([]);
    expect(paginateMenu([section("A", 2, 2)], 10)).toEqual([]);
  });

  it("gives each page its share of the slide time, never under the minimum", () => {
    expect(pageSeconds(20, 2)).toBe(10);
    expect(pageSeconds(20, 10)).toBe(4);
    expect(pageSeconds(20, 0)).toBe(20);
  });
});

describe("rotation", () => {
  const empty: TvFeedSlide = { id: "empty", kind: "music", seconds: 10, content: { thisWeekend: [], comingUp: [] } };
  const music: TvFeedSlide = { id: "music", kind: "music", seconds: 10, content: { thisWeekend: [{ id: "e", title: "Band", date: "2026-10-10", startTime: null, endTime: null }], comingUp: [] } };
  const standings: TvFeedSlide = { id: "pool", kind: "standings", seconds: 15, content: {} as PoolTv, joinPath: null };
  const drinks: TvFeedSlide = { id: "drinks", kind: "drinks", seconds: 20, content: [section("On tap", 2)] };

  it("knows which slides have something to show", () => {
    const week = (n: number): TvFeedSlide => ({
      id: "cal",
      kind: "calendar",
      seconds: 15,
      content: [{ date: "2026-10-07", entries: Array.from({ length: n }, (_, i) => ({ key: `k${i}`, title: "Trivia", startTime: null, endTime: null, type: "event" as const, note: null, link: null })) }],
    });
    expect([empty, music, standings, drinks, { ...drinks, content: [section("On tap", 2, 2)] }, week(0), week(2)].map(slideHasContent)).toEqual([false, true, true, true, false, false, true]);
  });

  it("moves to the next slide, wraps round, and skips empty ones", () => {
    const list = [standings, empty, music, drinks];
    expect(nextSlideIndex(list, null)).toBe(0);
    expect(nextSlideIndex(list, "pool")).toBe(2); // the empty music slide is skipped
    expect(nextSlideIndex(list, "music")).toBe(3);
    expect(nextSlideIndex(list, "drinks")).toBe(0); // wraps round
    expect(nextSlideIndex(list, "gone")).toBe(0); // the playlist changed under us: start again
    expect(nextSlideIndex([standings], "pool")).toBe(0);
    expect(nextSlideIndex([empty], null)).toBeNull();
    expect(nextSlideIndex([], null)).toBeNull();
  });
});

describe("how long a slide stays up", () => {
  const menu = (sections: MenuSection[], seconds: number): TvFeedSlide => ({ id: "m", kind: "kitchen", seconds, content: sections });
  const long = (seconds: number) => menu([section("A", 11), section("B", 11), section("C", 11), section("D", 11), section("E", 11)], seconds);

  it("is the set time for a short menu and other slides", () => {
    expect(slideDurationMs(menu([section("A", 3)], 20))).toBe(20_000);
    expect(slideDurationMs({ id: "u", kind: "music", seconds: 12, content: { thisWeekend: [], comingUp: [] } })).toBe(12_000);
  });

  it("shares a long menu's time over its pages, never under 4 seconds a page", () => {
    const pages = menuPagesOf(long(60)).length;
    expect(pages).toBeGreaterThan(2); // 60 rows at 24 a page
    expect(slideDurationMs(long(60))).toBe(pages * Math.floor(60 / pages) * 1000);
    // With only 5 seconds set, each page still gets the 4 second minimum: the slide runs longer.
    expect(slideDurationMs(long(5))).toBe(pages * 4000);
  });

  it("finds the page that shows at a moment in the slide", () => {
    const pages = menuPagesOf(long(5)).length;
    expect(menuPageAt(long(5), 0)).toBe(0);
    expect(menuPageAt(long(5), 3_999)).toBe(0);
    expect(menuPageAt(long(5), 4_000)).toBe(1);
    expect(menuPageAt(long(5), 10_000_000)).toBe(pages - 1);
    expect(menuPageAt(menu([section("A", 2)], 20), 19_000)).toBe(0);
  });
});
