import { useEffect } from "react";
import { Link, Outlet, useParams } from "react-router";
import type { MeSummary } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { rememberPool } from "../lib/lastPool";
import type { PoolScreen } from "../lib/tabs";

// The strip at the top of a pool's screens: Pick | Standings. Stats joins it once it has
// content. It also records the pool and screen, so the Play tab can return to them.
// Used as a layout route around the pick screen and the standings.

export function PoolScreenTabs() {
  const { poolId = "", entryId } = useParams();
  const { data: summary } = useApi<MeSummary>("/me/summary");
  const current: PoolScreen = entryId ? "pick" : "standings";

  useEffect(() => {
    if (poolId) rememberPool({ poolId, screen: current });
  }, [poolId, current]);

  // The pick screen needs the person's entry in this pool; someone viewing a pool they have
  // not entered (an admin) gets Standings only.
  const entry = entryId ? { entryId } : summary?.entries.find((e) => e.poolId === poolId);
  const tabs: { key: PoolScreen; label: string; to: string }[] = [];
  if (entry) tabs.push({ key: "pick", label: "Pick", to: `/pool/${poolId}/entry/${entry.entryId}/pick` });
  tabs.push({ key: "standings", label: "Standings", to: `/pool/${poolId}` });

  return (
    <>
      {tabs.length > 1 && (
        <nav aria-label="Pool screens" className="mx-auto max-w-lg px-6 pt-4">
          <ul className="flex gap-1 rounded-[12px] border border-brand-border bg-brand-surface p-1">
            {tabs.map((tab) => (
              <li key={tab.key} className="flex-1">
                <Link
                  to={tab.to}
                  aria-current={tab.key === current ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center rounded-[10px] text-sm font-semibold ${
                    tab.key === current ? "bg-brand-accent-soft text-brand-text" : "text-brand-muted"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Outlet />
    </>
  );
}
