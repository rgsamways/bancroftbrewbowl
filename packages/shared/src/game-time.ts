// Time helpers for the pick screens. Kickoffs are stored and sent as UTC and always shown in
// Eastern time (the brewery's clock). Countdowns are measured against the server's time.
// No Node imports: bundled into the browser.

export const DISPLAY_TIME_ZONE = "America/Toronto";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE, weekday: "long" });
const shortDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE, weekday: "short" });
const timeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE });

/** "Sunday" */
export function dayHeading(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** "Sun 1:00 PM" */
export function formatKickoff(iso: string): string {
  const time = timeFormat.format(new Date(iso)).replace(/\s/g, " ").replace("a.m.", "AM").replace("p.m.", "PM");
  return `${shortDayFormat.format(new Date(iso))} ${time}`;
}

/** "1:00 PM" */
export function formatKickoffTime(iso: string): string {
  return timeFormat.format(new Date(iso)).replace(/\s/g, " ").replace("a.m.", "AM").replace("p.m.", "PM");
}

/** A key that is the same for every kickoff on the same Eastern calendar day. */
export function easternDayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

/** "2d 14h 37m", "3h 5m", "12m", "less than a minute". Never negative. */
export function formatCountdown(ms: number): string {
  if (ms < 60_000) return "less than a minute";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
