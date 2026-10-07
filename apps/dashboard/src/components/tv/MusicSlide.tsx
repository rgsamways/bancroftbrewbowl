import { formatEventDayLong, formatEventTime, type PublicMusic } from "@bbb/shared";

const MAX_EVENTS = 8;

/** What is coming up: this weekend first, then later dates, the next event at the top. */
export function MusicSlide({ music }: { music: PublicMusic }) {
  const events = [...music.thisWeekend, ...music.comingUp].slice(0, MAX_EVENTS);
  return (
    <div data-testid="tv-music" className="flex h-full flex-col px-11 pb-6 pt-8">
      <h2 className="mb-4 text-[34px] font-semibold text-brand-text">Live music</h2>
      <ol className="flex-1">
        {events.map((e, i) => (
          <li key={e.id} data-testid="tv-music-event" className={`flex items-center gap-6 border-b border-brand-border py-3 ${i === 0 ? "text-[34px]" : "text-[28px]"}`}>
            <span className="w-[210px] flex-none font-semibold text-brand-accent">{formatEventDayLong(e.date)}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-brand-text">{e.title}</span>
            <span className="flex-none text-[24px] text-brand-muted">{formatEventTime(e.startTime, e.endTime)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
