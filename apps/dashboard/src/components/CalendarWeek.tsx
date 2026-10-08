import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  calendarDayHeading,
  calendarHasEntries,
  formatEventDayLong,
  formatEventTime,
  type PublicCalendar,
  type PublicCalendarEntry,
} from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { CalendarTag } from "./CalendarTag";

function timeText(e: PublicCalendarEntry): string {
  return e.startTime ? formatEventTime(e.startTime, e.endTime) : "All day";
}

function LinkButton({ link }: { link: NonNullable<PublicCalendarEntry["link"]> }) {
  const cls = "mt-2 inline-flex min-h-11 items-center rounded-[12px] border border-brand-border px-4 text-sm font-semibold text-brand-text hover:border-brand-accent";
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {link.label}
    </a>
  ) : (
    <Link to={link.href} className={cls}>
      {link.label}
    </Link>
  );
}

function Entry({ entry }: { entry: PublicCalendarEntry }) {
  return (
    <li data-testid="calendar-entry" className="border-b border-brand-border px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-brand-text">{entry.title}</p>
        <CalendarTag type={entry.type} />
      </div>
      <p className="text-sm text-brand-muted">{timeText(entry)}</p>
      {entry.note && <p className="mt-1 whitespace-pre-line text-sm text-brand-muted">{entry.note}</p>}
      {entry.link && <LinkButton link={entry.link} />}
    </li>
  );
}

/** Seven days starting today (or at `?from=`), one list per day, with arrows 7 days at a time. */
export function CalendarWeek() {
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const { data: cal, error } = useApi<PublicCalendar>(`/public/calendar${from ? `?from=${encodeURIComponent(from)}` : ""}`);

  if (error && !cal) {
    return <p className="mt-6 text-sm text-brand-muted">{error.status === 400 ? "That date is too far away." : "We couldn't load the calendar. Check your connection and try again."}</p>;
  }
  if (!cal) return null;

  const go = (date: string) => setParams(date === cal.today ? {} : { from: date });
  const atStart = cal.from <= cal.today;
  const last = addDays(cal.from, 6);
  const arrow = "grid h-11 w-11 flex-none place-items-center rounded-full border border-brand-border text-brand-text disabled:opacity-30";

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={atStart} onClick={() => go(addDays(cal.from, -7))} aria-label="Earlier days" className={arrow}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <p data-testid="calendar-range" className="text-sm font-semibold text-brand-text">
            {formatEventDayLong(cal.from)} to {formatEventDayLong(last)}
          </p>
          {!atStart && (
            <button type="button" onClick={() => go(cal.today)} className="min-h-11 text-sm font-semibold text-brand-accent underline">
              Back to today
            </button>
          )}
        </div>
        <button type="button" onClick={() => go(addDays(cal.from, 7))} aria-label="Later days" className={arrow}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {!calendarHasEntries(cal.days) && (
        <p className="mt-4 rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">Nothing is planned for these days yet. Check back soon.</p>
      )}

      <div className="mt-4 space-y-5">
        {cal.days.map((day) => (
          <section key={day.date} data-testid="calendar-day" aria-label={formatEventDayLong(day.date)}>
            <h2 className={`mb-2 flex items-baseline gap-2 text-sm font-semibold ${day.date === cal.today ? "text-brand-accent" : "text-brand-muted"}`}>
              {calendarDayHeading(day.date, cal.today, formatEventDayLong)}
              {day.date === cal.today || day.date === addDays(cal.today, 1) ? <span className="font-normal text-brand-faint">{formatEventDayLong(day.date)}</span> : null}
            </h2>
            {day.entries.length === 0 ? (
              <p className="rounded-[14px] border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-faint">Nothing planned</p>
            ) : (
              <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                {day.entries.map((e) => (
                  <Entry key={e.key} entry={e} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className="pt-4 text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}
