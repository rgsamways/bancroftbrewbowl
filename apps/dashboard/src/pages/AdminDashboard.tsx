import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import type { RulesConfig } from "@bbb/shared";
import { api } from "../lib/api";
import { WeekPills, WeekStatus, type Week } from "../components/WeekWidgets";
import { useAdminPanel } from "../components/AdminPanelContext";

type Pool = { id: string; name: string; seasonYear: number; status: string; rules: RulesConfig };
type Entry = { id: string; displayName: string; email: string; status: string };
type Game = {
  id: string;
  weekNumber: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  result: string;
};

const TABS = ["Pools", "Games", "Entries", "Picks"] as const;
type Tab = (typeof TABS)[number];

export function AdminDashboard() {
  const { poolId } = useParams();
  const [tab, setTab] = useState<Tab>(poolId ? "Games" : "Pools");
  const { setPoolId, setShowCreatePool } = useAdminPanel();

  useEffect(() => {
    setTab(poolId ? "Games" : "Pools");
  }, [poolId]);

  useEffect(() => {
    setPoolId(poolId ?? null);
  }, [poolId, setPoolId]);

  useEffect(() => {
    setShowCreatePool(tab === "Pools");
  }, [tab, setShowCreatePool]);

  // Leaving the admin section entirely (e.g. to Schedule or Home) should
  // clear the right panel rather than leaving a stale pool's forms visible.
  useEffect(() => {
    return () => {
      setPoolId(null);
      setShowCreatePool(false);
    };
  }, [setPoolId, setShowCreatePool]);

  return (
    <div className="w-full px-6 pb-6">
      <div className="mb-6 flex gap-1 border-b border-brand-border">
        {TABS.map((t) => {
          const disabled = t !== "Pools" && !poolId;
          return (
            <button
              key={t}
              disabled={disabled}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
                tab === t
                  ? "border-brand-accent text-brand-accent"
                  : disabled
                    ? "border-transparent text-brand-muted/40"
                    : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "Pools" && <PoolsTab currentPoolId={poolId} />}
      {tab === "Games" && poolId && <GamesTab poolId={poolId} />}
      {tab === "Entries" && poolId && <EntriesTab poolId={poolId} />}
      {tab === "Picks" && poolId && <PicksTab poolId={poolId} />}
    </div>
  );
}

function GamesTab({ poolId }: { poolId: string }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    api<Pool>(`/pools/${poolId}`).then(setPool);
  }, [poolId]);

  useEffect(() => {
    if (!pool) return;
    api<Week[]>(`/nfl/weeks?year=${pool.seasonYear}`).then((fetched) => {
      setWeeks(fetched);
      setSelectedWeek((current) => current ?? fetched[0]?.weekNumber ?? null);
    });
  }, [pool]);

  useEffect(() => {
    if (!pool || selectedWeek === null) return;
    api<Game[]>(`/nfl/games?year=${pool.seasonYear}&week=${selectedWeek}`).then(setGames);
  }, [pool, selectedWeek]);

  if (!pool) return null;

  if (weeks.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        No games imported for the {pool.seasonYear} season yet — see the Schedule page.
      </p>
    );
  }

  const activeWeek = weeks.find((w) => w.weekNumber === selectedWeek);

  return (
    <div>
      <p className="mb-4 text-sm text-brand-muted">
        Results are shared across every {pool.seasonYear} pool — enter them from the Schedule page.
      </p>
      <WeekPills weeks={weeks} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
      {activeWeek && <WeekStatus week={activeWeek} />}

      <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {games.map((g) => (
          <li key={g.id} className="flex items-center justify-between px-3 py-2 text-sm text-brand-text">
            <span>
              {g.awayTeam} @ {g.homeTeam}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                g.result === "pending"
                  ? "bg-brand-surface-raised text-brand-muted"
                  : "bg-brand-surface-raised text-brand-text"
              }`}
            >
              {g.result}
            </span>
          </li>
        ))}
        {games.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No games this week</li>}
      </ul>
    </div>
  );
}

function PoolsTab({ currentPoolId }: { currentPoolId: string | undefined }) {
  const [pools, setPools] = useState<Pool[]>([]);

  function refresh() {
    api<Pool[]>("/pools").then(setPools);
  }

  useEffect(refresh, []);

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {pools.map((pool) => (
          <li key={pool.id}>
            <Link
              to={`/admin/${pool.id}`}
              className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-surface-raised ${
                pool.id === currentPoolId ? "bg-brand-surface-raised font-semibold text-brand-accent" : ""
              }`}
            >
              <span>{pool.name}</span>
              <span className="text-brand-muted">
                {pool.seasonYear} · {pool.status}
              </span>
            </Link>
          </li>
        ))}
        {pools.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No pools yet</li>}
      </ul>
    </div>
  );
}

type WipeoutEntry = { id: string; displayName: string; email: string; status: string };
type WipeoutEvent = {
  id: string;
  weekNumber: number;
  game: { homeTeam: string; awayTeam: string } | null;
  candidateEntries: WipeoutEntry[];
};

function WipeoutBanner({ poolId, onResolved }: { poolId: string; onResolved: () => void }) {
  const [wipeouts, setWipeouts] = useState<WipeoutEvent[]>([]);
  const [survivors, setSurvivors] = useState<Record<string, Set<string>>>({});

  function refresh() {
    api<WipeoutEvent[]>(`/pools/${poolId}/wipeouts`).then(setWipeouts);
  }

  useEffect(refresh, [poolId]);

  function toggleSurvivor(wipeoutId: string, entryId: string) {
    setSurvivors((current) => {
      const set = new Set(current[wipeoutId] ?? []);
      if (set.has(entryId)) set.delete(entryId);
      else set.add(entryId);
      return { ...current, [wipeoutId]: set };
    });
  }

  async function resolve(wipeoutId: string) {
    const surviving = [...(survivors[wipeoutId] ?? [])];
    await api(`/pools/${poolId}/wipeouts/${wipeoutId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ surviving_entry_ids: surviving }),
    });
    refresh();
    onResolved();
  }

  if (wipeouts.length === 0) return null;

  return (
    <div className="space-y-4">
      {wipeouts.map((w) => (
        <div key={w.id} className="rounded border border-amber-800 bg-amber-950 p-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-amber-400">
            Wipeout — Week {w.weekNumber}
            {w.game && (
              <span className="normal-case text-amber-400/70">
                {" "}
                ({w.game.awayTeam} @ {w.game.homeTeam})
              </span>
            )}
          </h3>
          <p className="mb-3 mt-1 text-sm text-amber-200">
            This result would eliminate every remaining entry. Pick which entries survive, if any.
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {w.candidateEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleSurvivor(w.id, entry.id)}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  survivors[w.id]?.has(entry.id)
                    ? "bg-emerald-600 text-white"
                    : "bg-brand-surface-raised text-brand-muted hover:text-brand-text"
                }`}
              >
                {entry.displayName}
              </button>
            ))}
          </div>
          <button
            onClick={() => resolve(w.id)}
            className="rounded bg-brand-accent px-3 py-2 font-display text-sm font-semibold text-white hover:bg-brand-accent-hover"
          >
            Resolve
          </button>
        </div>
      ))}
    </div>
  );
}

function EntriesTab({ poolId }: { poolId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  function refresh() {
    api<Entry[]>(`/pools/${poolId}/entries`).then(setEntries);
  }

  useEffect(refresh, [poolId]);

  return (
    <div className="space-y-6">
      <WipeoutBanner poolId={poolId} onResolved={refresh} />

      <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {entries.map((e) => (
          <li key={e.id} className="flex justify-between px-3 py-2 text-sm text-brand-text">
            <span>
              {e.displayName} <span className="text-brand-muted">({e.email})</span>
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                e.status === "alive" ? "bg-emerald-950 text-emerald-400" : "bg-brand-surface-raised text-brand-muted"
              }`}
            >
              {e.status}
            </span>
          </li>
        ))}
        {entries.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No entries yet</li>}
      </ul>
    </div>
  );
}

type PoolPick = { entryId: string; weekNumber: number; teamCode: string; result: string };
type PickSortKey = "name" | number;

// Rank used when sorting by a week column: winning first, then still-pending
// (game not decided yet), then tied, then losing, then no pick at all.
function pickRank(pick: PoolPick | undefined): number {
  if (!pick) return 4;
  if (pick.result === "win") return 0;
  if (pick.result === "pending") return 1;
  if (pick.result === "tie") return 2;
  return 3;
}

// Only survivor pools exist today, so this always renders the survivor
// matrix. Once pool types exist, this is where that branch would go.
function PicksTab({ poolId }: { poolId: string }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [picks, setPicks] = useState<PoolPick[]>([]);
  const [sortKey, setSortKey] = useState<PickSortKey>("name");

  useEffect(() => {
    api<Pool>(`/pools/${poolId}`).then(setPool);
    api<Entry[]>(`/pools/${poolId}/entries`).then(setEntries);
    api<PoolPick[]>(`/pools/${poolId}/picks`).then(setPicks);
  }, [poolId]);

  useEffect(() => {
    if (!pool) return;
    api<Week[]>(`/nfl/weeks?year=${pool.seasonYear}`).then(setWeeks);
  }, [pool]);

  const pickLookup = useMemo(() => {
    const map = new Map<string, Map<number, PoolPick>>();
    for (const pick of picks) {
      if (!map.has(pick.entryId)) map.set(pick.entryId, new Map());
      map.get(pick.entryId)!.set(pick.weekNumber, pick);
    }
    return map;
  }, [picks]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortKey === "name") return a.displayName.localeCompare(b.displayName);
      const rankDiff =
        pickRank(pickLookup.get(a.id)?.get(sortKey)) - pickRank(pickLookup.get(b.id)?.get(sortKey));
      return rankDiff !== 0 ? rankDiff : a.displayName.localeCompare(b.displayName);
    });
  }, [entries, sortKey, pickLookup]);

  if (!pool) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-border">
            <th
              onClick={() => setSortKey("name")}
              className={`cursor-pointer whitespace-nowrap px-3 py-2 text-left font-display text-xs font-semibold uppercase tracking-wide ${
                sortKey === "name" ? "text-brand-accent" : "text-brand-muted"
              }`}
            >
              Name
            </th>
            {weeks.map((w) => (
              <th
                key={w.weekNumber}
                onClick={() => setSortKey(w.weekNumber)}
                className={`cursor-pointer whitespace-nowrap px-3 py-2 text-center font-display text-xs font-semibold uppercase tracking-wide ${
                  sortKey === w.weekNumber ? "text-brand-accent" : "text-brand-muted"
                }`}
              >
                Wk{w.weekNumber}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border">
          {sortedEntries.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap px-3 py-2 text-brand-text">{entry.displayName}</td>
              {weeks.map((w) => {
                const pick = pickLookup.get(entry.id)?.get(w.weekNumber);
                return (
                  <td key={w.weekNumber} className="px-3 py-2 text-center">
                    {pick ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          pick.result === "win"
                            ? "bg-emerald-950 text-emerald-400"
                            : pick.result === "loss"
                              ? "bg-red-950 text-red-400"
                              : "bg-brand-surface-raised text-brand-muted"
                        }`}
                      >
                        {pick.teamCode}
                      </span>
                    ) : (
                      <span className="text-brand-muted">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {sortedEntries.length === 0 && (
            <tr>
              <td colSpan={weeks.length + 1} className="px-3 py-2 text-sm text-brand-muted">
                No entries yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
