import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import type { AdminSummary } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { PlayersTab } from "./admin-pool/PlayersTab";
import { PicksTab } from "./admin-pool/PicksTab";
import { SettingsTab } from "./admin-pool/SettingsTab";
import { kindLabel, type PoolRow } from "./admin-pool/shared";

type TabKey = "players" | "picks" | "settings";

/** One pool: its name and kind, and the Players, Picks (Survivor only) and Settings tabs. */
export function AdminPool() {
  const { poolId = "" } = useParams();
  const [params] = useSearchParams();
  const { data: pool, error, reload } = useApi<PoolRow>(`/pools/${poolId}`);
  const { data: summary } = useApi<AdminSummary>("/admin/summary");

  if (error && !pool) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-4">
        <p className="text-sm text-brand-muted">{error.status === 404 ? "We couldn't find that pool." : "We couldn't load this pool. Check your connection and try again."}</p>
        <Link to="/admin/pools" className="mt-4 inline-block text-sm font-semibold text-brand-accent">
          Back to Pools
        </Link>
      </div>
    );
  }
  if (!pool) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "players", label: "Players" },
    ...(pool.type === "survivor" ? [{ key: "picks" as const, label: "Picks" }] : []),
    { key: "settings", label: "Settings" },
  ];
  const asked = params.get("tab");
  const tab = tabs.find((t) => t.key === asked)?.key ?? "players";

  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/pools" className="inline-flex min-h-11 items-center gap-1 text-sm text-brand-muted">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Pools
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">{pool.name}</h1>
        <p className="text-sm text-brand-muted">
          {kindLabel(pool.type)} &middot; {pool.seasonYear} season
        </p>
      </div>

      <nav aria-label="Pool sections" className="grid gap-1 rounded-[14px] border border-brand-border bg-brand-surface p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            to={`/admin/pools/${pool.id}?tab=${t.key}`}
            replace
            aria-current={t.key === tab ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-[10px] text-sm font-semibold ${
              t.key === tab ? "bg-brand-accent-soft text-brand-text ring-1 ring-brand-accent/50" : "text-brand-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "players" && <PlayersTab pool={pool} summary={summary} />}
      {tab === "picks" && <PicksTab pool={pool} />}
      {tab === "settings" && <SettingsTab pool={pool} onChanged={() => void reload()} />}
    </div>
  );
}
