import { formatKickoff, type SummaryEntry } from "@bbb/shared";

// The two short lines a pool is described with in the pool list and Home's switcher, so the
// wording lives in one place. See openspec/changes/pool-list-switcher.

type NeedInput = Pick<SummaryEntry, "state" | "poolType" | "lockTime">;
type StandingInput = Pick<SummaryEntry, "poolType" | "status" | "eliminatedWeek" | "points" | "rank" | "tied">;

/** What needs doing: "Pick due Thu 8:15 PM", "Pick made", "Locked", "Out", ... */
export function entryNeed(e: NeedInput): string {
  const picks = e.poolType === "pick_em" ? "Picks" : "Pick";
  switch (e.state) {
    case "needs_picks":
      return e.lockTime ? `${picks} due ${formatKickoff(e.lockTime)}` : `${picks} needed`;
    case "picked":
      return e.poolType === "pick_em" ? "Picks made" : "Pick made";
    case "locked":
      return "Locked";
    case "eliminated":
      return "Out";
    case "season_over":
      return "Season over";
    case "no_games":
      return "No games yet";
  }
}

/** Where the person stands: "Alive", "Out in week 3", or "1st · 12 pts" for pick 'em. */
export function entryStanding(e: StandingInput): string {
  if (e.poolType === "survivor") {
    return e.status === "alive" ? "Alive" : e.eliminatedWeek ? `Out in week ${e.eliminatedWeek}` : "Out";
  }
  const points = `${e.points ?? 0} ${(e.points ?? 0) === 1 ? "pt" : "pts"}`;
  if (e.rank === null) return points;
  return `${e.tied ? "T" : ""}${ordinal(e.rank)} · ${points}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
