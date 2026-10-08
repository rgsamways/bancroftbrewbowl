import { and, asc, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import {
  CALENDAR_DAYS,
  addDays,
  occurrencesForRange,
  resolveLink,
  type AdminCalendar,
  type CalendarLink,
  type CalendarType,
  type EntryRow,
  type ExceptionRow,
  type MusicEvent,
  type PublicCalendar,
  type PublicCalendarDay,
  type Repeat,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { calendarEntries, calendarExceptions, musicEvents, pools } from "../db/schema.js";


const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

type LinkColumns = { linkKind: string | null; linkTarget: string | null; linkLabel: string | null };
export const linkOf = (c: LinkColumns): CalendarLink | null =>
  c.linkKind && c.linkTarget ? { kind: c.linkKind as "app" | "url", target: c.linkTarget, label: c.linkLabel } : null;
export const linkColumns = (link: { kind: "app" | "url"; target: string; label?: string | null } | null | undefined): LinkColumns =>
  link ? { linkKind: link.kind, linkTarget: link.target, linkLabel: link.label?.trim() || null } : { linkKind: null, linkTarget: null, linkLabel: null };

export const toEntryRow = (r: typeof calendarEntries.$inferSelect): EntryRow => ({
  id: r.id,
  date: r.entryDate,
  title: r.title,
  startTime: hm(r.startTime),
  endTime: hm(r.endTime),
  type: r.type as CalendarType,
  note: r.note,
  link: linkOf(r),
  repeat: r.repeat as Repeat,
  repeatUntil: r.repeatUntil,
});

const toExceptionRow = (r: typeof calendarExceptions.$inferSelect): ExceptionRow => ({
  entryId: r.entryId,
  date: r.exceptionDate,
  cancelled: r.cancelled,
  title: r.title,
  startTime: hm(r.startTime),
  endTime: hm(r.endTime),
  type: r.type as CalendarType | null,
  note: r.note,
  link: linkOf(r),
});

/** The days from `from` for `days` days, with every entry that falls in them. */
async function loadDays(from: string, days: number) {
  const to = addDays(from, days - 1);
  // An entry can matter if it has started by the last day and has not ended before the first.
  const entryRows = await db
    .select()
    .from(calendarEntries)
    .where(and(lte(calendarEntries.entryDate, to), or(isNull(calendarEntries.repeatUntil), gte(calendarEntries.repeatUntil, from)), or(gte(calendarEntries.entryDate, from), ne(calendarEntries.repeat, "none"))))
    .orderBy(asc(calendarEntries.entryDate));
  const exceptionRows =
    entryRows.length === 0
      ? []
      : await db
          .select()
          .from(calendarExceptions)
          .where(and(inArray(calendarExceptions.entryId, entryRows.map((e) => e.id)), gte(calendarExceptions.exceptionDate, from), lte(calendarExceptions.exceptionDate, to)));
  const music: MusicEvent[] = (
    await db
      .select()
      .from(musicEvents)
      .where(and(gte(musicEvents.eventDate, from), lte(musicEvents.eventDate, to)))
      .orderBy(asc(musicEvents.eventDate), asc(musicEvents.startTime))
  ).map((m) => ({ id: m.id, title: m.title, date: m.eventDate, startTime: hm(m.startTime), endTime: hm(m.endTime) }));
  return occurrencesForRange({ entries: entryRows.map(toEntryRow), exceptions: exceptionRows.map(toExceptionRow), music }, from, days);
}

/** What anyone may read: titles, times, types, notes and links to click. */
export async function loadPublicCalendar(from: string, today: string, days = CALENDAR_DAYS): Promise<PublicCalendar> {
  const raw = await loadDays(from, days);
  const poolIds = [
    ...new Set(
      raw
        .flatMap((d) => d.entries)
        .map((e) => e.link?.target)
        .filter((t): t is string => !!t && t.startsWith("pool:"))
        .map((t) => t.slice("pool:".length))
    ),
  ];
  const existing = new Set(poolIds.length > 0 ? (await db.select({ id: pools.id }).from(pools).where(inArray(pools.id, poolIds))).map((p) => p.id) : []);
  const publicDays: PublicCalendarDay[] = raw.map((d) => ({
    date: d.date,
    entries: d.entries.map((e) => ({
      key: e.key,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      type: e.type,
      note: e.note,
      link: resolveLink(e.link, (id) => existing.has(id)),
    })),
  }));
  return { from, today, days: publicDays };
}

/** What an admin's list needs: who an entry belongs to, whether it repeats, and music marked as such. */
export async function loadAdminCalendar(from: string, today: string, days = CALENDAR_DAYS): Promise<AdminCalendar> {
  const raw = await loadDays(from, days);
  return {
    from,
    today,
    days: raw.map((d) => ({
      date: d.date,
      entries: d.entries.map(({ link: _link, ...rest }) => rest),
    })),
  };
}
