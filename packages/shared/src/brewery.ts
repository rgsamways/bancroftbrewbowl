import { z } from "zod";
import { formatEventDayLong, formatEventTime, isRealDate, weekdayOf, type MusicEvent } from "./music.js";
import type { MenuKind } from "./menu.js";

// "From the brewery": what is happening at the brewery, posted by admins and shown to players on
// Home. A featured menu item, specials on the days they run, and an announcement for a week.
// No Node imports.

export const BREWERY_KINDS = ["announcement", "feature", "special"] as const;
export type BreweryKind = (typeof BREWERY_KINDS)[number];

export const SPECIAL_TAGS = ["kitchen_special", "game_day", "family_night"] as const;
export type SpecialTag = (typeof SPECIAL_TAGS)[number];
export const SPECIAL_TAG_TEXT: Record<SpecialTag, string> = {
  kitchen_special: "Kitchen special",
  game_day: "Game-day special",
  family_night: "Family night",
};

export const MAX_WEEK = 22;
export const STANDARD_ANNOUNCEMENT = {
  title: "Watch with us",
  message: "Sunday games on the big screen. Make your pick before kickoff, then cheer them on together.",
} as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const optionalTime = z
  .string()
  .regex(TIME, "Use a time like 13:00")
  .nullish()
  .transform((v) => v ?? null);

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    message: z.string().trim().min(1).max(300),
    weekNumber: z.number().int().min(1).max(MAX_WEEK),
  })
  .strict();
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const FEATURE_SCOPES = ["week", "open"] as const;
export const createFeatureSchema = z
  .object({ menuItemId: z.string().uuid(), scope: z.enum(FEATURE_SCOPES) })
  .strict();
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

export const createSpecialSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    details: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => v || null),
    tag: z.enum(SPECIAL_TAGS).nullish().transform((v) => v ?? null),
    days: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .nullish()
      .transform((v) => (v && v.length > 0 ? [...new Set(v)] : null)),
    date: z
      .string()
      .refine(isRealDate, "Not a real date")
      .nullish()
      .transform((v) => v ?? null),
    startTime: optionalTime,
    endTime: optionalTime,
  })
  .strict()
  .refine((v) => (v.days === null) !== (v.date === null), { message: "Pick days of the week, or one date, not both", path: ["days"] })
  .refine((v) => v.endTime === null || v.startTime !== null, { message: "An end time needs a start time", path: ["endTime"] })
  .refine((v) => v.endTime === null || v.startTime === null || v.endTime > v.startTime, { message: "The end must be after the start", path: ["endTime"] });
export type CreateSpecialInput = z.infer<typeof createSpecialSchema>;

export type SpecialSchedule = { days: number[] | null; date: string | null; startTime: string | null; endTime: string | null };

const PLURAL_DAY = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** "Sundays, 1 – 4 PM", "Fridays and Saturdays", "Sat Oct 10, 7 PM". */
export function scheduleText(s: SpecialSchedule): string {
  const when =
    s.date !== null
      ? formatEventDayLong(s.date)
      : (() => {
          const days = MONDAY_FIRST.filter((d) => s.days?.includes(d)).map((d) => PLURAL_DAY[d]!);
          if (days.length === 7) return "Every day";
          return days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
        })();
  return s.startTime ? `${when}, ${formatEventTime(s.startTime, s.endTime)}` : when;
}

/** Whether a special is on today (an Eastern calendar date). */
export function specialShowsOn(s: Pick<SpecialSchedule, "days" | "date">, today: string): boolean {
  return s.date !== null ? s.date === today : (s.days ?? []).includes(weekdayOf(today));
}

/** A one-day special whose date has gone no longer shows or counts as showing now. */
export function specialIsOver(s: Pick<SpecialSchedule, "date">, today: string): boolean {
  return s.date !== null && s.date < today;
}

// What the Home request carries.
export type BreweryFeatured = {
  id: string;
  name: string;
  kind: MenuKind;
  style: string | null;
  abv: string | null;
  priceCents: number | null;
};
export type BrewerySpecial = { id: string; title: string; details: string | null; tag: SpecialTag | null; when: string };
export type BreweryAnnouncement = { title: string; message: string };
export type BreweryHome = {
  /** The first music event this weekend, or null. */
  live: MusicEvent | null;
  featured: BreweryFeatured | null;
  specials: BrewerySpecial[];
  /** Null means Home shows the standard message. */
  announcement: BreweryAnnouncement | null;
};

// What the admin "Showing now" list carries.
export type BreweryItem = { id: string; kind: BreweryKind; title: string; detail: string };
