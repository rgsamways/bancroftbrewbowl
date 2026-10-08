import { z } from "zod";
import { addDays, isRealDate, weekdayOf, type MusicEvent } from "./music.js";

// The brewery calendar: dated entries (bands, specials, events, closures) with simple repeats and
// one-day changes. Days are worked out when asked for; nothing is stored per day. Dates are plain
// "YYYY-MM-DD" strings and times are the brewery's clock "HH:MM", so no time zone or daylight
// saving arithmetic ever touches them. No Node imports.

export const CALENDAR_TYPES = ["music", "food", "drink", "event", "closed", "other"] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];
export const CALENDAR_TYPE_TEXT: Record<CalendarType, string> = {
  music: "Music",
  food: "Food special",
  drink: "Drink special",
  event: "Event",
  closed: "Closed",
  other: "Other",
};

export const REPEATS = ["none", "weekly", "biweekly", "monthly_weekday"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_TEXT: Record<Repeat, string> = {
  none: "Just this day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly_weekday: "Monthly on the same weekday",
};

export const MAX_TITLE = 80;
export const MAX_NOTE = 300;
export const MAX_LINK_LABEL = 30;
export const DEFAULT_LINK_LABEL = "Learn more";
export const CALENDAR_DAYS = 7;
/** How far from today a week may be asked for. */
export const CALENDAR_RANGE_DAYS = 730;

// ---- Links: a page in the app, or an https address, and nothing else ------------------------------

export const APP_LINKS = {
  menu: { path: "/menu", label: "See the menu" },
  kitchen: { path: "/menu/kitchen", label: "See the kitchen menu" },
  music: { path: "/menu/music", label: "See live music" },
  calendar: { path: "/menu/calendar", label: "See the calendar" },
  help: { path: "/help", label: "How to play" },
  signup: { path: "/", label: "Sign in to play" },
} as const;
export type AppLinkTarget = keyof typeof APP_LINKS;
export const APP_LINK_TARGETS = Object.keys(APP_LINKS) as AppLinkTarget[];

const POOL_TARGET = /^pool:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export type CalendarLink = { kind: "app" | "url"; target: string; label: string | null };
export type ResolvedLink = { href: string; label: string; external: boolean };

export const linkSchema = z
  .object({
    kind: z.enum(["app", "url"]),
    target: z.string().trim().min(1).max(300),
    label: z.string().trim().max(MAX_LINK_LABEL, `Keep the label to ${MAX_LINK_LABEL} characters`).nullish(),
  })
  .strict()
  .refine((l) => (l.kind === "app" ? l.target in APP_LINKS || POOL_TARGET.test(l.target) : isHttpsUrl(l.target)), {
    message: "A link must be a page in the app or a web address that starts with https://",
    path: ["target"],
  });

/** Turns a stored link into something to click. A link to a pool that is gone resolves to nothing. */
export function resolveLink(link: CalendarLink | null, poolExists: (id: string) => boolean): ResolvedLink | null {
  if (!link) return null;
  const label = link.label?.trim() || null;
  if (link.kind === "url") return isHttpsUrl(link.target) ? { href: link.target, label: label ?? DEFAULT_LINK_LABEL, external: true } : null;
  if (link.target in APP_LINKS) {
    const app = APP_LINKS[link.target as AppLinkTarget];
    return { href: app.path, label: label ?? app.label, external: false };
  }
  if (POOL_TARGET.test(link.target)) {
    const id = link.target.slice("pool:".length);
    return poolExists(id) ? { href: `/join/${id}`, label: label ?? "Join the pool", external: false } : null;
  }
  return null;
}

// ---- What an admin types --------------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const optionalTime = z.string().regex(TIME, "Use a time like 19:30").nullish();

const detailShape = {
  title: z.string().trim().min(1, "Add a title").max(MAX_TITLE, `Keep the title to ${MAX_TITLE} characters`),
  startTime: optionalTime,
  endTime: optionalTime,
  type: z.enum(CALENDAR_TYPES),
  note: z.string().trim().max(MAX_NOTE, `Keep the note to ${MAX_NOTE} characters`).nullish(),
  link: linkSchema.nullish(),
};

const timesAgree = (v: { startTime?: string | null; endTime?: string | null }) =>
  !v.endTime || (!!v.startTime && v.endTime >= v.startTime);
const TIMES_MESSAGE = { message: "The end time can't be before the start time", path: ["endTime"] };

/** One day's details: used for the single-day change of a repeating entry. */
export const dayDetailsSchema = z.object(detailShape).strict().refine(timesAgree, TIMES_MESSAGE);
export type DayDetailsInput = z.infer<typeof dayDetailsSchema>;

export const entrySchema = z
  .object({
    ...detailShape,
    date: z.string().refine(isRealDate, "Not a real date"),
    repeat: z.enum(REPEATS),
    repeatUntil: z.string().refine(isRealDate, "Not a real date").nullish(),
  })
  .strict()
  .refine(timesAgree, TIMES_MESSAGE)
  .refine((v) => !v.repeatUntil || v.repeatUntil >= v.date, { message: "The end date can't be before the first day", path: ["repeatUntil"] });
export type EntryInput = z.infer<typeof entrySchema>;

// ---- Working out the days -------------------------------------------------------------------------

export type EntryRow = {
  id: string;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  type: CalendarType;
  note: string | null;
  link: CalendarLink | null;
  repeat: Repeat;
  repeatUntil: string | null;
};

/** One day of a repeating entry that was cancelled (`cancelled`) or replaced (the fields are then the
 * whole of that day's details). */
export type ExceptionRow = {
  entryId: string;
  date: string;
  cancelled: boolean;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  type: CalendarType | null;
  note: string | null;
  link: CalendarLink | null;
};

export type CalendarOccurrence = {
  /** Stable within a day, for lists. */
  key: string;
  /** Null for a music event, which is changed on the Music screens. */
  entryId: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
  type: CalendarType;
  note: string | null;
  link: CalendarLink | null;
  fromMusic: boolean;
  /** Part of a repeating entry. */
  repeats: boolean;
  /** This day was changed on its own. */
  changedDay: boolean;
};
export type CalendarDay = { date: string; entries: CalendarOccurrence[] };

const dayNumber = (date: string) => Number(date.slice(8, 10));
const daysBetween = (from: string, to: string) => Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);

/** Does this entry (or series) happen on `date`? The first day is the anchor for every rule. */
export function occursOn(entry: Pick<EntryRow, "date" | "repeat" | "repeatUntil">, date: string): boolean {
  if (date < entry.date) return false;
  if (entry.repeatUntil && date > entry.repeatUntil) return false;
  switch (entry.repeat) {
    case "none":
      return date === entry.date;
    case "weekly":
      return daysBetween(entry.date, date) % 7 === 0;
    case "biweekly":
      return daysBetween(entry.date, date) % 14 === 0;
    case "monthly_weekday":
      // The same weekday, in the same position in the month (the 2nd Friday). A 5th weekday only
      // happens in months that have one.
      return weekdayOf(date) === weekdayOf(entry.date) && Math.ceil(dayNumber(date) / 7) === Math.ceil(dayNumber(entry.date) / 7);
  }
}

const byTimeThenTitle = (a: CalendarOccurrence, b: CalendarOccurrence) => {
  if ((a.startTime === null) !== (b.startTime === null)) return a.startTime === null ? -1 : 1;
  return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
};

/** `days` consecutive days starting at `from`, each with its entries in order (all-day first, then by
 * start time). Music events come in as entries of type Music. */
export function occurrencesForRange(
  input: { entries: EntryRow[]; exceptions: ExceptionRow[]; music: MusicEvent[] },
  from: string,
  days: number = CALENDAR_DAYS
): CalendarDay[] {
  const exceptions = new Map(input.exceptions.map((e) => [`${e.entryId}|${e.date}`, e]));
  const out: CalendarDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const entries: CalendarOccurrence[] = [];
    for (const entry of input.entries) {
      if (!occursOn(entry, date)) continue;
      const exception = exceptions.get(`${entry.id}|${date}`);
      if (exception?.cancelled) continue;
      const repeats = entry.repeat !== "none";
      if (exception) {
        entries.push({
          key: `${entry.id}|${date}`,
          entryId: entry.id,
          title: exception.title ?? entry.title,
          startTime: exception.startTime,
          endTime: exception.endTime,
          type: exception.type ?? entry.type,
          note: exception.note,
          link: exception.link,
          fromMusic: false,
          repeats,
          changedDay: true,
        });
      } else {
        entries.push({
          key: `${entry.id}|${date}`,
          entryId: entry.id,
          title: entry.title,
          startTime: entry.startTime,
          endTime: entry.endTime,
          type: entry.type,
          note: entry.note,
          link: entry.link,
          fromMusic: false,
          repeats,
          changedDay: false,
        });
      }
    }
    for (const m of input.music) {
      if (m.date !== date) continue;
      entries.push({
        key: `music|${m.id}`,
        entryId: null,
        title: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
        type: "music",
        note: null,
        link: null,
        fromMusic: true,
        repeats: false,
        changedDay: false,
      });
    }
    entries.sort(byTimeThenTitle);
    out.push({ date, entries });
  }
  return out;
}

// ---- What the screens read ------------------------------------------------------------------------

export type PublicCalendarEntry = Omit<CalendarOccurrence, "entryId" | "link" | "fromMusic" | "repeats" | "changedDay"> & { link: ResolvedLink | null };
export type PublicCalendarDay = { date: string; entries: PublicCalendarEntry[] };
export type PublicCalendar = { from: string; today: string; days: PublicCalendarDay[] };

export type AdminCalendarEntry = Omit<CalendarOccurrence, "link">;
export type AdminCalendarDay = { date: string; entries: AdminCalendarEntry[] };
export type AdminCalendar = { from: string; today: string; days: AdminCalendarDay[] };

/** A day of a repeating entry that was changed on its own: these are that day's whole details. */
export type ChangedDay = Pick<ExceptionRow, "date" | "title" | "startTime" | "endTime" | "type" | "note" | "link">;
export type AdminCalendarEntryDetail = EntryRow & { cancelledDays: string[]; changedDays: ChangedDay[] };

/** Is `from` a date the calendar may be asked for, relative to today? */
export function calendarFromAllowed(from: string, today: string): boolean {
  return isRealDate(from) && Math.abs(daysBetween(today, from)) <= CALENDAR_RANGE_DAYS;
}

/** Names the day for a list: "Today", "Tomorrow", or "Wed Oct 14". */
export function calendarDayHeading(date: string, today: string, longDay: (d: string) => string): string {
  const diff = daysBetween(today, date);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : longDay(date);
}

export function calendarHasEntries(days: { entries: unknown[] }[]): boolean {
  return days.some((d) => d.entries.length > 0);
}

export { daysBetween };

/** How many entries a day card on the TV shows before "+N more". */
export const TV_CALENDAR_LINES = 4;

export function capEntries<T>(entries: T[], max: number = TV_CALENDAR_LINES): { shown: T[]; more: number } {
  return entries.length <= max ? { shown: entries, more: 0 } : { shown: entries.slice(0, max), more: entries.length - max };
}
