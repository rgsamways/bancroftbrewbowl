import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import type { MeSummary, SummaryEntry } from "@bbb/shared";
import { api } from "../lib/api";
import { attentionOrder, pickPathFor } from "../lib/attention";
import { entryNeed, entryStanding } from "../lib/entryNeed";
import { lastPoolPath, poolScreenPath, readLastPool } from "../lib/lastPool";

// The Play tab. With two or more pools it is the pool list: a card per pool, the ones that need
// a pick first, each opening that pool on the screen last used. With one pool it opens the pool
// screen the person was last on (on this device), else its pick screen, the same choice as Home.
// A player in no pool is pointed back to Home. There is no section bar yet: Games and Leagues
// have no content, so Pools is the only section (see playSections).

function PoolList({ entries }: { entries: SummaryEntry[] }) {
  const screen = readLastPool()?.screen ?? "pick";
  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold text-brand-text">Your pools</h1>
      <ul className="mt-4 space-y-3">
        {attentionOrder(entries).map((e) => (
          <li key={e.entryId}>
            <Link
              to={poolScreenPath(e, screen)}
              className="block rounded-[14px] border border-brand-border bg-brand-surface p-4 hover:border-brand-accent"
            >
              <span className="block break-words font-semibold text-brand-text">{e.poolName}</span>
              <span className="mt-0.5 block text-xs text-brand-muted">
                {e.poolType === "pick_em" ? "Pick 'em" : "Survivor"} &middot; {entryStanding(e)}
              </span>
              <span className={`mt-2 block text-sm ${e.state === "needs_picks" ? "font-semibold text-brand-accent" : "text-brand-muted"}`}>
                {entryNeed(e)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlayLanding() {
  const [summary, setSummary] = useState<MeSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<MeSummary>("/me/summary")
      .then(setSummary)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="px-6 pt-6 text-sm text-brand-muted">We couldn't load your pools. Check your connection and try again.</p>;
  }
  if (summary === null) return null;

  if (summary.entries.length > 1) return <PoolList entries={summary.entries} />;

  const remembered = lastPoolPath(readLastPool(), summary.entries);
  if (remembered) return <Navigate to={remembered} replace />;
  const first = attentionOrder(summary.entries)[0];
  if (first) return <Navigate to={pickPathFor(first)} replace />;

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold text-brand-text">Play</h1>
      <p className="mt-4 text-sm text-brand-muted">You haven't joined a pool yet. Join one first, then it will show up here.</p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center rounded bg-brand-accent px-4 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover"
      >
        Go to Home
      </Link>
    </div>
  );
}
