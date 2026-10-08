import { CALENDAR_TYPE_TEXT, type CalendarType } from "@bbb/shared";

// A small tag naming an entry's type. The name is always there, so colour is never the only signal.
const COLOUR: Record<CalendarType, string> = {
  music: "bg-brand-accent-soft text-brand-accent",
  food: "bg-emerald-500/15 text-emerald-300",
  drink: "bg-sky-500/15 text-sky-300",
  event: "bg-violet-500/15 text-violet-300",
  closed: "bg-red-500/15 text-red-300",
  other: "bg-brand-surface-raised text-brand-muted",
};

export function CalendarTag({ type, large }: { type: CalendarType; large?: boolean }) {
  return (
    <span data-testid="calendar-tag" className={`inline-block flex-none rounded-full font-semibold ${COLOUR[type]} ${large ? "px-3 py-0.5 text-base" : "px-2 py-0.5 text-xs"}`}>
      {CALENDAR_TYPE_TEXT[type]}
    </span>
  );
}
