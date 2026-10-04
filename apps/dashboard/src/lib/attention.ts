import type { EntryState, SummaryEntry } from "@bbb/shared";

// Which entry "needs attention" first. Used by Home (which hero to open on) and by the
// Pick tab (where to go), so they always agree.

const ORDER: Record<EntryState, number> = {
  needs_picks: 0,
  picked: 1,
  locked: 2,
  eliminated: 3,
  season_over: 4,
  no_games: 5,
};

/** Entries sorted: picks still to make (soonest lock first), then picked, locked, out,
 * season over. The sort is stable, so equal entries keep the order they were joined in. */
export function attentionOrder<T extends Pick<SummaryEntry, "state" | "lockTime">>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const byState = ORDER[a.state] - ORDER[b.state];
    if (byState !== 0) return byState;
    if (a.lockTime && b.lockTime) return Date.parse(a.lockTime) - Date.parse(b.lockTime);
    return 0;
  });
}

export const pickPathFor = (e: Pick<SummaryEntry, "poolId" | "entryId">) => `/pool/${e.poolId}/entry/${e.entryId}/pick`;
