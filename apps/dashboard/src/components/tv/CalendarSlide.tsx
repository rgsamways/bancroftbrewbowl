import { capEntries, formatEventDay, formatEventTime, type PublicCalendarDay } from "@bbb/shared";
import { CalendarTag } from "../CalendarTag";

/** The next 7 days as seven cards: today first and highlighted, each day's entries as large lines
 * with their time and a type tag, "+N more" when a day has more than fit, "Nothing planned" for a
 * quiet day. Links are not shown (nobody can tap a TV). */
export function CalendarSlide({ days }: { days: PublicCalendarDay[] }) {
  return (
    <div data-testid="tv-calendar" className="flex h-full flex-col px-8 pb-6 pt-7">
      <h2 className="mb-4 px-1 text-[34px] font-semibold text-brand-text">What&apos;s on</h2>
      <div className="grid flex-1 grid-cols-7 gap-2.5">
        {days.map((day, i) => {
          const [weekday, dateNumber] = formatEventDay(day.date).split(" ");
          const { shown, more } = capEntries(day.entries);
          const today = i === 0;
          return (
            <section
              key={day.date}
              data-testid="tv-calendar-day"
              data-today={today ? "true" : undefined}
              aria-label={`${weekday} ${dateNumber}`}
              className={`flex min-w-0 flex-col overflow-hidden rounded-[16px] border px-3 py-3 ${today ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-brand-surface"}`}
            >
              <header className="mb-2 flex items-baseline justify-between border-b border-brand-border pb-2">
                <span className={`text-[20px] font-semibold uppercase tracking-wide ${today ? "text-brand-accent" : "text-brand-muted"}`}>{today ? "Today" : weekday}</span>
                <span className="text-[30px] font-semibold leading-none tabular-nums text-brand-text">{dateNumber}</span>
              </header>
              {day.entries.length === 0 ? (
                <p className="mt-1 text-[18px] text-brand-faint">Nothing planned</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {shown.map((e) => (
                    <li key={e.key} data-testid="tv-calendar-entry">
                      <p className="text-[16px] leading-tight text-brand-muted">{e.startTime ? formatEventTime(e.startTime, e.endTime) : "All day"}</p>
                      <p className="line-clamp-3 text-[21px] font-medium leading-tight text-brand-text">{e.title}</p>
                      <div className="mt-1">
                        <CalendarTag type={e.type} />
                      </div>
                    </li>
                  ))}
                  {more > 0 && (
                    <li data-testid="tv-calendar-more" className="text-[18px] font-semibold text-brand-accent">
                      +{more} more
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
