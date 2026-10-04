import { z } from "zod";
import { DISPLAY_TIME_ZONE } from "./game-time.js";

// Live music and events: a list anyone can read, kept current by admins. Dates are calendar
// dates and times are the brewery's clock (Eastern), stored as typed, so there is no time zone
// arithmetic on them. No Node imports.

export const MAX_EVENT_TITLE = 80;

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE });

/** Today's date in Eastern time as "YYYY-MM-DD". */
export function easternToday(now: Date): string {
  return dateKeyFormat.format(now);
}

const utcOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
};

export function addDays(date: string, days: number): string {
  return new Date(utcOf(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 is Sunday, 6 is Saturday. */
export function weekdayOf(date: string): number {
  return new Date(utcOf(date)).getUTCDay();
}

/** True for a real calendar date written "YYYY-MM-DD" (so 2026-02-31 is not). */
export function isRealDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(utcOf(date)).toISOString().slice(0, 10) === date;
}

/** The weekend is Friday to Sunday. Monday to Thursday it is the coming one; Friday to Sunday it
 * is the current one, with days already gone dropped (so `start` is never before today). */
export function weekendWindow(today: string): { start: string; end: string } {
  const dow = weekdayOf(today);
  const friday = dow >= 1 && dow <= 4 ? addDays(today, 5 - dow) : dow === 5 ? today : addDays(today, dow === 6 ? -1 : -2);
  return { start: friday < today ? today : friday, end: addDays(friday, 2) };
}

export type EventBucket = "past" | "thisWeekend" | "comingUp";

export function bucketOf(date: string, today: string): EventBucket {
  if (date < today) return "past";
  const w = weekendWindow(today);
  return date >= w.start && date <= w.end ? "thisWeekend" : "comingUp";
}

/** The date of the coming Friday, Saturday and Sunday (today counts when it is one of them). */
export function nextWeekendDates(today: string): string[] {
  const w = weekendWindow(today);
  return [0, 1, 2].map((i) => addDays(addDays(w.end, -2), i)).filter((d) => d >= today);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const optionalTime = z
  .string()
  .regex(TIME, "Use a time like 13:00")
  .nullish()
  .transform((v) => v ?? null);

export const createMusicEventSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_EVENT_TITLE),
    date: z.string().refine(isRealDate, "Not a real date"),
    startTime: optionalTime,
    endTime: optionalTime,
  })
  .strict()
  .refine((v) => v.endTime === null || v.startTime !== null, { message: "An end time needs a start time", path: ["endTime"] })
  .refine((v) => v.endTime === null || v.startTime === null || v.endTime > v.startTime, { message: "The end must be after the start", path: ["endTime"] });
export type CreateMusicEventInput = z.infer<typeof createMusicEventSchema>;
export const updateMusicEventSchema = createMusicEventSchema;

export type MusicEvent = { id: string; title: string; date: string; startTime: string | null; endTime: string | null };
export type PublicMusic = { thisWeekend: MusicEvent[]; comingUp: MusicEvent[] };
export type AdminMusic = { comingUp: MusicEvent[]; past: MusicEvent[] };

const clock = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return { h12: h! % 12 === 0 ? 12 : h! % 12, m: m!, pm: h! >= 12 };
};
const part = (t: ReturnType<typeof clock>, withSuffix: boolean) =>
  `${t.h12}${t.m ? `:${String(t.m).padStart(2, "0")}` : ""}${withSuffix ? (t.pm ? " PM" : " AM") : ""}`;

/** "1 – 4 PM", "11:30 AM – 1 PM", "7 PM", or "Time to be confirmed". */
export function formatEventTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "Time to be confirmed";
  const s = clock(startTime);
  if (!endTime) return part(s, true);
  const e = clock(endTime);
  return `${part(s, s.pm !== e.pm)} – ${part(e, true)}`;
}

/** "Fri 9" */
export function formatEventDay(date: string): string {
  const day = new Date(utcOf(date)).toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" });
  return `${day} ${Number(date.slice(8, 10))}`;
}

/** "Fri Oct 9" */
export function formatEventDayLong(date: string): string {
  return new Date(utcOf(date)).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).replace(/,/g, "");
}
