import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { api } from "../lib/api";

type Pool = { id: string; name: string; seasonYear: number; status: string };
type Entry = {
  id: string;
  displayName: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
};

export function PoolStandings() {
  const { poolId } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId) return;
    api<Pool>(`/pools/${poolId}`).then(setPool).catch((e) => setError(e.message));
    api<Entry[]>(`/pools/${poolId}/entries`).then(setEntries).catch((e) => setError(e.message));
  }, [poolId]);

  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!pool) return <p className="p-6 text-brand-muted">Loading…</p>;

  const alive = entries.filter((e) => e.status === "alive");
  const eliminated = entries.filter((e) => e.status === "eliminated");

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-brand-text">{pool.name}</h1>

      <section>
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-emerald-400">
          Still alive ({alive.length})
        </h2>
        <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
          {alive.map((entry) => (
            <li key={entry.id} className="px-3 py-2">
              <Link to={`/pool/${poolId}/entry/${entry.id}/pick`} className="hover:text-brand-accent">
                {entry.displayName}
              </Link>
            </li>
          ))}
          {alive.length === 0 && <li className="px-3 py-2 text-brand-muted">Nobody yet</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Eliminated ({eliminated.length})
        </h2>
        <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
          {eliminated.map((entry) => (
            <li key={entry.id} className="flex justify-between px-3 py-2 text-brand-muted">
              <span>{entry.displayName}</span>
              <span>week {entry.eliminatedWeek}</span>
            </li>
          ))}
          {eliminated.length === 0 && <li className="px-3 py-2 text-brand-muted">Nobody yet</li>}
        </ul>
      </section>
    </div>
  );
}
