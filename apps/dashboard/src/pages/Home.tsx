import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../lib/auth-client";
import { api } from "../lib/api";

type Pool = { id: string; name: string; seasonYear: number; status: string };
type MyEntry = {
  id: string;
  poolId: string;
  displayName: string;
  status: "alive" | "eliminated";
  pool: Pool;
};

export function Home() {
  const { data: session } = useSession();
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);

  function refresh() {
    api<MyEntry[]>("/me/entries").then(setMyEntries);
    api<Pool[]>("/pools").then(setPools);
  }

  useEffect(refresh, []);

  const joinedPoolIds = new Set(myEntries.map((e) => e.poolId));
  const availablePools = pools.filter((p) => !joinedPoolIds.has(p.id));

  return (
    <div className="mx-auto max-w-lg px-6 pb-6">
      <p className="mb-8 text-brand-muted">
        Welcome{session?.user.name ? `, ${session.user.name}` : ""}
      </p>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Your pools
        </h2>
        <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
          {myEntries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={
                  entry.status === "alive"
                    ? `/pool/${entry.poolId}/entry/${entry.id}/pick`
                    : `/pool/${entry.poolId}`
                }
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-surface-raised"
              >
                <span className="text-brand-text">{entry.pool.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    entry.status === "alive"
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-brand-surface-raised text-brand-muted"
                  }`}
                >
                  {entry.status}
                </span>
              </Link>
            </li>
          ))}
          {myEntries.length === 0 && (
            <li className="px-3 py-2 text-sm text-brand-muted">You haven't joined a pool yet</li>
          )}
        </ul>
      </section>

      {availablePools.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Join a pool
          </h2>
          <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
            {availablePools.map((pool) => (
              <JoinPoolRow key={pool.id} pool={pool} onJoined={refresh} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function JoinPoolRow({ pool, onJoined }: { pool: Pool; onJoined: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join() {
    setError(null);
    setJoining(true);
    try {
      await api(`/pools/${pool.id}/join`, { method: "POST" });
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
      setJoining(false);
    }
  }

  return (
    <li className="flex items-center justify-between px-3 py-2">
      <span className="text-sm text-brand-text">
        {pool.name} <span className="text-brand-muted">({pool.seasonYear})</span>
      </span>
      <span className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={join}
          disabled={joining}
          className="rounded bg-brand-accent px-3 py-1 text-sm font-semibold text-white hover:bg-brand-accent-hover disabled:opacity-40"
        >
          Join
        </button>
      </span>
    </li>
  );
}
