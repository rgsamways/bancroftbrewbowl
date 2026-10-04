import type { HiddenPick } from "@bbb/shared";

// The one place that decides who may see which pick. Both read routes use it, so
// the rule can't drift between them. It is pure (no database, no clock) so every
// case can be tested directly.
//
// The rules (see openspec/changes/secure-pick-access):
//  - your own picks: always, in full;
//  - anyone's picks for a week that has locked: in full;
//  - someone else's pick for a week that hasn't locked:
//      an ordinary player gets nothing, not even a sign that a pick exists;
//      an admin gets a "has picked" marker with no team and no result.
// Being an admin never widens what you see of other people's unlocked picks.

export type Viewer = { userId: string; isAdmin: boolean };

/** A pick row plus who owns the entry it belongs to (null for an unclaimed entry). */
export type OwnedPick = { entryId: string; weekNumber: number; ownerUserId: string | null };

export function visiblePicks<T extends OwnedPick>(
  rows: readonly T[],
  viewer: Viewer,
  lockedWeeks: ReadonlySet<number>
): (Omit<T, "ownerUserId"> | HiddenPick)[] {
  const out: (Omit<T, "ownerUserId"> | HiddenPick)[] = [];
  for (const row of rows) {
    const { ownerUserId, ...rest } = row;
    const isOwn = ownerUserId !== null && ownerUserId === viewer.userId;

    if (isOwn || lockedWeeks.has(row.weekNumber)) {
      out.push(rest);
    } else if (viewer.isAdmin) {
      out.push({ entryId: row.entryId, weekNumber: row.weekNumber, teamCode: null, result: null, submitted: true });
    }
    // else: an ordinary player sees nothing for someone else's unlocked pick.
  }
  return out;
}
