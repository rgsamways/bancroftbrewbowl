// The kinds of admin change the activity record knows about, with the title and category
// shown on the Activity page. A new kind (menu, music, confirmations) is added here: the
// table stores `kind` as plain text, so it needs no migration. No Node imports.

export const ACTIVITY_CATEGORIES = ["standings", "pool", "content", "menu"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_KINDS = {
  result_entered: { title: "Entered a result", category: "standings" },
  result_changed: { title: "Changed a result", category: "standings" },
  score_updated: { title: "Updated a score", category: "standings" },
  wipeout_resolved: { title: "Resolved a wipeout", category: "standings" },
  player_status_changed: { title: "Changed a player's status", category: "standings" },
  player_added: { title: "Added a player", category: "standings" },
  confirmation_requested: { title: "Asked another admin to confirm", category: "standings" },
  confirmation_confirmed: { title: "Confirmed another admin's decision", category: "standings" },
  confirmation_declined: { title: "Did not confirm another admin's decision", category: "standings" },
  pool_created: { title: "Created a pool", category: "pool" },
  pool_locked: { title: "Locked a pool's rules", category: "pool" },
  pool_unlocked: { title: "Unlocked a pool's rules", category: "pool" },
  pool_settings_changed: { title: "Changed a pool's settings", category: "pool" },
  pool_total_changed: { title: "Changed a pool total", category: "pool" },
  pool_deleted: { title: "Deleted a pool", category: "pool" },
  promotion_created: { title: "Added an announcement", category: "content" },
  promotion_updated: { title: "Edited an announcement", category: "content" },
  promotion_deleted: { title: "Removed an announcement", category: "content" },
  canned_promotion_changed: { title: "Changed an automatic offer", category: "content" },
} as const satisfies Record<string, { title: string; category: ActivityCategory }>;

export type ActivityKind = keyof typeof ACTIVITY_KINDS;

export const ACTIVITY_FILTERS = ["everything", "standings", "own", "menu"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export const ACTIVITY_PAGE_SIZE = 50;

/** The kinds a filter shows. "own" is by flag, not by kind, so it is handled by the query. */
export function kindsForFilter(filter: Exclude<ActivityFilter, "everything" | "own">): ActivityKind[] {
  const categories: ActivityCategory[] = filter === "standings" ? ["standings", "pool"] : ["menu"];
  return (Object.keys(ACTIVITY_KINDS) as ActivityKind[]).filter((k) => categories.includes(ACTIVITY_KINDS[k].category));
}

export type ActivityEntry = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  actorName: string;
  actorId: string | null;
  poolId: string | null;
  affectsOwnEntry: boolean;
  createdAt: string;
};

export type ActivityPage = {
  entries: ActivityEntry[];
  /** Pass as `before` to get the next older page; null when there is no more. */
  nextBefore: string | null;
};
