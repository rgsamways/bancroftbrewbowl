import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { formatActivityTime, type ActivityEntry, type ActivityFilter, type ActivityPage as ActivityPageData } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useSession } from "../lib/auth-client";

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "everything", label: "Everything" },
  { key: "standings", label: "Standings" },
  { key: "own", label: "Your own entry" },
  { key: "menu", label: "Menu" },
];

function Entry({ entry, nowIso, viewerId }: { entry: ActivityEntry; nowIso: string; viewerId?: string }) {
  const mark = entry.affectsOwnEntry ? (entry.actorId === viewerId ? "Your own entry" : `Affects ${entry.actorName}'s entry`) : null;
  return (
    <li className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
      <p className="text-xs text-brand-faint">{formatActivityTime(entry.createdAt, nowIso)}</p>
      <p className="mt-0.5 font-semibold text-brand-text">{entry.title}</p>
      <p className="mt-1 text-sm text-brand-muted">{entry.summary}</p>
      {mark && (
        <span className="mt-2 inline-block rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">
          {mark}
        </span>
      )}
    </li>
  );
}

/** The permanent record of admin changes. Read-only: nothing here can be edited or deleted. */
export function ActivityPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<ActivityFilter>("everything");
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nowIso] = useState(() => new Date().toISOString());

  const load = useCallback(async (which: ActivityFilter, before?: string) => {
    const query = new URLSearchParams({ filter: which });
    if (before) query.set("before", before);
    try {
      const page = await api<ActivityPageData>(`/admin/activity?${query}`);
      setFailed(false);
      setNextBefore(page.nextBefore);
      setEntries((current) => (before && current ? [...current, ...page.entries] : page.entries));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setNotAllowed(true);
      else setFailed(true);
    }
  }, []);

  useEffect(() => {
    setEntries(null);
    void load(filter);
  }, [filter, load]);

  // Players get nothing from this page: send them home without showing any records.
  if (notAllowed) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-lg px-6 pb-6">
      <p className="text-sm text-brand-muted">Every change that affects the standings or the menu, and who made it.</p>

      <div role="group" aria-label="Filter" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              filter === f.key
                ? "border-brand-accent bg-brand-accent-soft text-brand-text"
                : "border-brand-border bg-brand-surface text-brand-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {failed && (
        <p role="alert" className="mt-4 text-sm text-brand-danger">
          We couldn't load the activity. Check your connection and try again.
        </p>
      )}

      {entries && (
        <>
          <ul className="mt-4 space-y-3">
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} nowIso={nowIso} viewerId={session?.user.id} />
            ))}
          </ul>
          {entries.length === 0 && !failed && (
            <p className="mt-4 text-sm text-brand-muted">
              {filter === "menu" ? "No menu changes yet." : filter === "own" ? "Nothing has affected your own entry." : "Nothing has been recorded yet."}
            </p>
          )}
          {nextBefore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                await load(filter, nextBefore);
                setLoadingMore(false);
              }}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-[12px] border border-brand-border text-sm font-semibold text-brand-text hover:border-brand-accent disabled:opacity-50"
            >
              Show earlier
            </button>
          )}
        </>
      )}

      <p className="mt-6 text-xs text-brand-faint">Nothing here can be edited or deleted. Players don't see this page.</p>
    </div>
  );
}
