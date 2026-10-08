import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import type { MeSummary } from "@bbb/shared";
import { api } from "../lib/api";
import { attentionOrder, pickPathFor } from "../lib/attention";
import { lastPoolPath, readLastPool } from "../lib/lastPool";

// The Play tab opens the pool screen the person was last on (on this device) when they are
// still in that pool; otherwise the pick screen of the entry that needs attention first, the
// same choice as Home. A player in no pool is pointed back to Home. There is no section bar yet:
// Games and Leagues have no content, so Pools is the only section (see playSections).

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
