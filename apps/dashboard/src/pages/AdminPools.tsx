import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import type { AdminSummary } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { kindLabel, statusLabel } from "./admin-pool/shared";

/** Every pool, with how many are playing and whether its rules are still open to change. */
export function AdminPools() {
  const { data: summary, error } = useApi<AdminSummary>("/admin/summary");

  if (error && !summary) {
    return <p className="px-6 pt-4 text-sm text-brand-muted">We couldn't load the pools. Check your connection and try again.</p>;
  }
  if (!summary) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 pb-6 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold leading-tight text-brand-text">Pools</h1>
          <p className="text-sm text-brand-muted">Everything running this season.</p>
        </div>
        <Link
          to="/admin/pools/new"
          className="flex min-h-11 flex-none items-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover"
        >
          New pool
        </Link>
      </div>

      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {summary.pools.map((pool) => (
          <li key={pool.id} className="border-b border-brand-border last:border-b-0">
            <Link to={`/admin/pools/${pool.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-brand-text">{pool.name}</span>
                <span className="block text-sm text-brand-muted">
                  {kindLabel(pool.type)} &middot; {pool.seasonYear} &middot; {pool.total} {pool.total === 1 ? "player" : "players"}
                </span>
              </span>
              <span className="flex-none rounded-full bg-brand-surface-raised px-2 py-0.5 text-xs font-semibold text-brand-muted">
                {statusLabel(pool.status)}
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {summary.pools.length === 0 && <li className="px-4 py-3 text-sm text-brand-muted">No pools yet. Tap New pool to open one.</li>}
      </ul>
    </div>
  );
}
