import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, calendarDayHeading, formatEventDayLong, formatEventTime, type AdminCalendar as AdminCalendarData, type AdminCalendarEntry } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { CalendarTag } from "../components/CalendarTag";
import { buttonClass } from "./admin-pool/shared";

function EntryRow({ entry, date }: { entry: AdminCalendarEntry; date: string }) {
  const time = entry.startTime ? formatEventTime(entry.startTime, entry.endTime) : "All day";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-brand-text">{entry.title}</span>
        <span className="block text-sm text-brand-muted">
          {time}
          {entry.repeats && " · repeats"}
          {entry.changedDay && " · changed for this day"}
          {entry.fromMusic && " · from Music"}
        </span>
      </span>
      <CalendarTag type={entry.type} />
    </>
  );
  const cls = "flex min-h-14 items-center gap-3 px-4 py-2";
  // A music event is changed on the Music screens; everything else opens its own form.
  if (entry.fromMusic) return <Link to={`/admin/music/${entry.key.replace("music|", "")}`} className={`${cls} hover:bg-brand-surface-raised`}>{body}</Link>;
  return (
    <Link to={`/admin/calendar/${entry.entryId}?date=${date}`} className={`${cls} hover:bg-brand-surface-raised`}>
      {body}
    </Link>
  );
}

/** Calendar: seven days at a time, with every entry that falls in them. Tap one to change it. */
export function AdminCalendar() {
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const { data: cal, error } = useApi<AdminCalendarData>(`/calendar/entries${from ? `?from=${encodeURIComponent(from)}` : ""}`);
  const go = (date: string) => setParams(cal && date === cal.today ? {} : { from: date });
  const arrow = "grid h-11 w-11 flex-none place-items-center rounded-full border border-brand-border text-brand-text";

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/more" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          More
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Calendar</h1>
        <p className="mt-1 text-sm text-brand-muted">Bands, specials, events and closures, shown on the calendar page and on the TVs. Live music you add under Music shows up here by itself.</p>
      </div>

      <Link to={`/admin/calendar/new${cal ? `?date=${cal.from}` : ""}`} className={buttonClass}>
        Add to the calendar
      </Link>

      {error && !cal && <p className="text-sm text-brand-muted">We couldn&apos;t load the calendar. Check your connection and try again.</p>}
      {cal && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => go(addDays(cal.from, -7))} aria-label="Earlier days" className={arrow}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-brand-text">
                {formatEventDayLong(cal.from)} to {formatEventDayLong(addDays(cal.from, 6))}
              </p>
              {cal.from !== cal.today && (
                <button type="button" onClick={() => go(cal.today)} className="min-h-11 text-sm font-semibold text-brand-accent underline">
                  Back to today
                </button>
              )}
            </div>
            <button type="button" onClick={() => go(addDays(cal.from, 7))} aria-label="Later days" className={arrow}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4">
            {cal.days.map((day) => (
              <section key={day.date} data-testid="admin-calendar-day">
                <h2 className="mb-1 text-sm font-semibold text-brand-muted">
                  {calendarDayHeading(day.date, cal.today, formatEventDayLong)}
                  <span className="ml-2 font-normal text-brand-faint">{formatEventDayLong(day.date)}</span>
                </h2>
                {day.entries.length === 0 ? (
                  <p className="rounded-[14px] border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-faint">Nothing planned</p>
                ) : (
                  <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                    {day.entries.map((e) => (
                      <li key={e.key} data-testid="admin-calendar-entry" className="border-b border-brand-border last:border-b-0">
                        <EntryRow entry={e} date={day.date} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
