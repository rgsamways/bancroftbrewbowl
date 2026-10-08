import type { PoolScreen } from "./tabs";

// Which pool screen a person was last on, kept on this device so the Play tab can return
// to it. Only the Play landing reads it, and it checks the pool against the person's own
// entries, so a stale or edited value falls back cleanly. See openspec/changes/bottom-nav-rethink.

const POOL_KEY = "bbb:last-pool";
const SCREEN_KEY = "bbb:last-pool-screen";

export type LastPool = { poolId: string; screen: PoolScreen };

export function readLastPool(storage: Pick<Storage, "getItem"> = localStorage): LastPool | null {
  try {
    const poolId = storage.getItem(POOL_KEY);
    const screen = storage.getItem(SCREEN_KEY);
    if (!poolId || (screen !== "pick" && screen !== "standings")) return null;
    return { poolId, screen };
  } catch {
    return null;
  }
}

export function rememberPool(last: LastPool, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(POOL_KEY, last.poolId);
    storage.setItem(SCREEN_KEY, last.screen);
  } catch {
    // Storage can be full or blocked (private mode); remembering is only a convenience.
  }
}

/** A pool's pick screen or standings, for an entry of the person's in that pool. */
export function poolScreenPath(entry: { poolId: string; entryId: string }, screen: PoolScreen): string {
  return screen === "standings" ? `/pool/${entry.poolId}` : `/pool/${entry.poolId}/entry/${entry.entryId}/pick`;
}

/** Where Play should open: the remembered screen when the person is still in that pool,
 * else null so the caller falls back to the entry that needs attention. */
export function lastPoolPath(
  last: LastPool | null,
  entries: readonly { poolId: string; entryId: string }[],
): string | null {
  if (!last) return null;
  const entry = entries.find((e) => e.poolId === last.poolId);
  return entry ? poolScreenPath(entry, last.screen) : null;
}
