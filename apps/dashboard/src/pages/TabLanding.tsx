import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { pickDestination, standingsDestination, type Destination, type EntryForTabs } from "../lib/tabs";

// Interim pages behind the Pick and Standings tabs. Pick and standings are per pool,
// so a tab needs a little help to know where to go: straight there with one pool,
// a short list with several, a nudge to join one with none. The decision itself is in
// lib/tabs.ts (tested); these pages only act on it. Later slices replace them with the
// designed Pick and Standings screens.

function TabLanding({ heading, decide }: { heading: string; decide: (entries: EntryForTabs[]) => Destination }) {
  const [entries, setEntries] = useState<EntryForTabs[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<EntryForTabs[]>("/me/entries")
      .then(setEntries)
      .catch(() => setFailed(true));
  }, []);

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-brand-text">{heading}</h1>
      <div className="mt-4">{children}</div>
    </div>
  );

  if (failed) return shell(<p className="text-sm text-brand-muted">We couldn't load your pools. Check your connection and try again.</p>);
  if (entries === null) return shell(<p className="text-sm text-brand-muted">Loading…</p>);

  const destination = decide(entries);

  if (destination.kind === "redirect") return <Navigate to={destination.to} replace />;

  if (destination.kind === "none") {
    return shell(
      <>
        <p className="text-sm text-brand-muted">You haven't joined a pool yet. Join one first, then it will show up here.</p>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-brand-accent px-4 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover"
        >
          Go to Home
        </Link>
      </>
    );
  }

  return shell(
    <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
      {destination.items.map((item) => (
        <li key={item.entryId}>
          <Link to={item.to} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-brand-surface-raised">
            <span className="min-w-0 truncate text-brand-text">{item.poolName}</span>
            <span className="flex shrink-0 items-center gap-2">
              {item.out && <span className="rounded bg-brand-surface-raised px-2 py-0.5 text-xs text-brand-muted">Out</span>}
              <ChevronRight className="h-4 w-4 text-brand-faint" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PickLanding() {
  return <TabLanding heading="Pick" decide={pickDestination} />;
}

export function StandingsLanding() {
  return <TabLanding heading="Standings" decide={standingsDestination} />;
}
