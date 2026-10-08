import { z } from "zod";
import { calendarHasEntries, type PublicCalendarDay } from "./calendar.js";
import type { MenuItem, MenuSection } from "./menu.js";
import type { PublicMusic } from "./music.js";
import type { PoolTv } from "./tv-recap.js";

// TV screens: a playlist is an ordered list of slides; a screen is one physical TV with its own
// private link that plays one playlist. Shared between the API and the browser. No Node imports.

export const SLIDE_KINDS = ["standings", "drinks", "kitchen", "music", "calendar"] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];
export const SLIDE_KIND_TEXT: Record<SlideKind, string> = {
  standings: "Standings",
  drinks: "Drinks",
  kitchen: "Kitchen",
  music: "Music",
  calendar: "Calendar",
};

export const MAX_PLAYLISTS = 20;
export const MAX_SLIDES = 12;
export const MAX_SCREENS = 10;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 120;
export const DEFAULT_SECONDS = 15;
/** A menu slide is split into pages that fit the screen; no page stays up for less than this. */
export const MIN_PAGE_SECONDS = 4;

const name = z.string().trim().min(1, "Add a name").max(60, "Keep the name to 60 characters");

export const slideInputSchema = z
  .object({
    kind: z.enum(SLIDE_KINDS),
    poolId: z.string().uuid().nullish().transform((v) => v ?? null),
    seconds: z.number().int().min(MIN_SECONDS, `At least ${MIN_SECONDS} seconds`).max(MAX_SECONDS, `At most ${MAX_SECONDS} seconds`),
    enabled: z.boolean(),
  })
  .strict()
  .refine((s) => (s.kind === "standings" ? s.poolId !== null : s.poolId === null), {
    message: "A Standings slide needs a pool, and the other slides don't take one",
    path: ["poolId"],
  });
export type SlideInput = z.infer<typeof slideInputSchema>;

export const playlistInputSchema = z
  .object({ name, slides: z.array(slideInputSchema).max(MAX_SLIDES, `At most ${MAX_SLIDES} slides`) })
  .strict();
export type PlaylistInput = z.infer<typeof playlistInputSchema>;

export const createScreenSchema = z.object({ name }).strict();

export const updateScreenSchema = z
  .object({
    name: name.optional(),
    playlistId: z.string().uuid().nullable().optional(),
    showQr: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;

// ---- What the admin screens read ----

export type AdminSlide = { id: string; kind: SlideKind; poolId: string | null; poolName: string | null; seconds: number; enabled: boolean };
export type AdminPlaylist = { id: string; name: string; slides: AdminSlide[]; screens: string[] };
/** `code` and `link` are present only for the god-user. */
export type AdminScreen = { id: string; name: string; playlistId: string | null; showQr: boolean; code?: string };
export type AdminTv = { playlists: AdminPlaylist[]; screens: AdminScreen[]; pools: { id: string; name: string }[] };

// ---- What a TV reads ----

export type TvFeedSlide =
  /** `joinPath` is the pool's join page while it takes new players, else null (the TV strip's QR code uses it). */
  | { id: string; kind: "standings"; seconds: number; content: PoolTv; joinPath: string | null }
  | { id: string; kind: "drinks" | "kitchen"; seconds: number; content: MenuSection[] }
  | { id: string; kind: "music"; seconds: number; content: PublicMusic }
  /** The next 7 days from today, in the brewery's time. */
  | { id: string; kind: "calendar"; seconds: number; content: PublicCalendarDay[] };
export type TvFeed = { screen: { name: string; showQr: boolean }; slides: TvFeedSlide[] };

/** Whether a slide has anything to show; an empty one is skipped. */
export function slideHasContent(slide: TvFeedSlide): boolean {
  if (slide.kind === "standings") return true;
  if (slide.kind === "music") return slide.content.thisWeekend.length + slide.content.comingUp.length > 0;
  if (slide.kind === "calendar") return calendarHasEntries(slide.content);
  return slide.content.some((s) => s.items.some((i) => i.available));
}

// ---- Menu paging ----

export type MenuRow = { type: "heading"; name: string; continued: boolean } | { type: "item"; item: MenuItem };
export type MenuPage = { columns: MenuRow[][] };

/** Splits menu sections into pages of `columns` columns of at most `perColumn` rows (at least 3). Sold-out
 * items are left out and empty sections vanish. A heading is never the last row of a column (it moves
 * down with its first item), and a section that carries over to the next column shows its heading again,
 * marked continued. */
export function paginateMenu(sections: MenuSection[], perColumn: number, columns = 2): MenuPage[] {
  const rowsPerColumn = Math.max(3, perColumn);
  const pages: MenuPage[] = [];
  let page: MenuPage = { columns: [[]] };
  const column = () => page.columns[page.columns.length - 1]!;
  function nextColumn() {
    if (page.columns.length < columns) {
      page.columns.push([]);
    } else {
      pages.push(page);
      page = { columns: [[]] };
    }
  }
  for (const section of sections) {
    const items = section.items.filter((i) => i.available);
    if (items.length === 0) continue;
    if (column().length + 2 > rowsPerColumn) nextColumn();
    column().push({ type: "heading", name: section.name, continued: false });
    for (const item of items) {
      if (column().length >= rowsPerColumn) {
        nextColumn();
        column().push({ type: "heading", name: section.name, continued: true });
      }
      column().push({ type: "item", item });
    }
  }
  if (page.columns.some((c) => c.length > 0)) pages.push(page);
  return pages;
}

/** How long each page of a menu slide shows: the slide's time shared out, never under the minimum. */
export function pageSeconds(seconds: number, pages: number): number {
  return Math.max(MIN_PAGE_SECONDS, Math.floor(seconds / Math.max(1, pages)));
}

/** The index of the slide to show after `currentId`, skipping slides with nothing to show. Returns
 * null when no slide has anything. A missing `currentId` (the playlist changed) starts from the top. */
export function nextSlideIndex(slides: TvFeedSlide[], currentId: string | null): number | null {
  if (slides.length === 0) return null;
  const from = currentId === null ? -1 : slides.findIndex((s) => s.id === currentId);
  for (let step = 1; step <= slides.length; step++) {
    const i = (from + step) % slides.length;
    if (slideHasContent(slides[i]!)) return i;
  }
  return null;
}

/** Rows in one column of a TV menu page. */
export const MENU_ROWS_PER_COLUMN = 12;

/** The pages a Drinks or Kitchen slide is split into (always at least one while it has content). */
export function menuPagesOf(slide: TvFeedSlide): MenuPage[] {
  return slide.kind === "drinks" || slide.kind === "kitchen" ? paginateMenu(slide.content, MENU_ROWS_PER_COLUMN) : [];
}

/** How long a slide stays up, in milliseconds. A menu slide's time is shared out over its pages, each
 * at least MIN_PAGE_SECONDS, so a long menu stays up a little longer than the time set. */
export function slideDurationMs(slide: TvFeedSlide): number {
  if (slide.kind === "drinks" || slide.kind === "kitchen") {
    const pages = Math.max(1, menuPagesOf(slide).length);
    return pages * pageSeconds(slide.seconds, pages) * 1000;
  }
  return slide.seconds * 1000;
}

/** Which page of a menu slide shows `elapsedMs` after the slide started. */
export function menuPageAt(slide: TvFeedSlide, elapsedMs: number): number {
  const pages = Math.max(1, menuPagesOf(slide).length);
  const each = pageSeconds(slide.seconds, pages) * 1000;
  return Math.min(pages - 1, Math.max(0, Math.floor(elapsedMs / each)));
}
