import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { Plus, Cog } from "lucide-react";
import { TIE_HANDLING, type RulesConfig } from "@bbb/shared";
import { api } from "../lib/api";
import { WeekPills, WeekStatus, type Week } from "../components/WeekWidgets";
import { useAdminPanel } from "../components/AdminPanelContext";
import { Modal } from "../components/Modal";
import { CreatePoolForm } from "../components/AdminPoolsPanel";

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
  const navigate = useNavigate();
  const { poolId } = useParams();
  const [tab, setTab] = useState<Tab>(poolId ? "Games" : "Pools");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { setPoolId, setPoolName } = useAdminPanel();

  useEffect(() => {
    setTab(poolId ? "Games" : "Pools");
  }, [poolId]);

  useEffect(() => {
    setPoolId(poolId ?? null);
    if (!poolId) {
      setPoolName(null);
      return;
    }
    api<Pool>(`/pools/${poolId}`).then((pool) => setPoolName(pool.name));
  }, [poolId, setPoolId, setPoolName]);

  // Leaving the admin section entirely (e.g. to Schedule or Home) should
  // clear the header title rather than leaving a stale pool's name visible.
  useEffect(() => {
    return () => {
      setPoolId(null);
      setPoolName(null);
    };
  }, [setPoolId, setPoolName]);

  return (
    <div className="w-full px-6 pb-6">
      <div className="mb-6 flex items-center justify-between border-b border-brand-border">
        <div className="flex gap-1">
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
        <div className="mb-1 flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            disabled={!poolId}
            aria-label="Pool settings"
            className="rounded border border-brand-border p-1.5 text-brand-text hover:border-brand-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Cog className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            aria-label="Create a pool"
            className="rounded bg-brand-accent p-1.5 text-white hover:bg-brand-accent-hover"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <CreatePoolForm
          onCreated={(pool) => {
            setShowCreateModal(false);
            navigate(`/admin/${pool.id}`);
          }}
        />
      </Modal>

      {poolId && (
        <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} maxWidthClassName="max-w-xl">
          <SettingsTab
            poolId={poolId}
            onDeleted={() => {
              setShowSettingsModal(false);
              navigate("/admin");
            }}
          />
        </Modal>
      )}

      {tab === "Pools" && <PoolsTab currentPoolId={poolId} />}
      {tab === "Games" && poolId && <GamesTab poolId={poolId} />}
      {tab === "Entries" && poolId && <EntriesTab poolId={poolId} />}
      {tab === "Picks" && poolId && <PicksTab poolId={poolId} />}
    </div>
  );
}

function SettingsTab({ poolId, onDeleted }: { poolId: string; onDeleted: () => void }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [name, setName] = useState("");
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function refresh() {
    setSaved(false);
    setError(null);
    api<Pool>(`/pools/${poolId}`).then((fetched) => {
      setPool(fetched);
      setName(fetched.name);
      setSeasonYear(fetched.seasonYear);
      setRules(fetched.rules);
    });
  }

  useEffect(refresh, [poolId]);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then(setSeasons);
  }, []);

  useEffect(() => {
    api<Week[]>(`/nfl/weeks?year=${seasonYear}`).then(setWeeks);
  }, [seasonYear]);

  const locked = pool?.status !== "draft";
  const seasonOptions = seasons.includes(seasonYear) ? seasons : [...seasons, seasonYear].sort();

  function toggleDoublePickWeek(weekNumber: number) {
    setRules((current) => {
      if (!current) return current;
      const has = current.double_pick_weeks.includes(weekNumber);
      return {
        ...current,
        double_pick_weeks: has
          ? current.double_pick_weeks.filter((w) => w !== weekNumber)
          : [...current.double_pick_weeks, weekNumber].sort((a, b) => a - b),
      };
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!rules) return;
    setError(null);
    setSaved(false);
    try {
      const updated = await api<Pool>(`/pools/${poolId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, season_year: seasonYear, rules }),
      });
      setPool(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  }

  async function toggleLock() {
    if (!pool) return;
    const updated = await api<Pool>(`/pools/${poolId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: locked ? "draft" : "active" }),
    });
    setPool(updated);
  }

  if (!pool || !rules) return null;

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Pool settings
        </h2>

        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={locked}
            required
            className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Season year
          <select
            value={seasonYear}
            onChange={(event) => setSeasonYear(Number(event.target.value))}
            disabled={locked}
            className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none disabled:opacity-50"
          >
            {seasonOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input
            type="checkbox"
            checked={rules.allow_repeat_teams}
            onChange={(event) => setRules({ ...rules, allow_repeat_teams: event.target.checked })}
            disabled={locked}
            className="accent-brand-accent"
          />
          Allow picking the same team more than once
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Tied game counts as
          <select
            value={rules.tie_counts_as}
            onChange={(event) =>
              setRules({ ...rules, tie_counts_as: event.target.value as RulesConfig["tie_counts_as"] })
            }
            disabled={locked}
            className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none disabled:opacity-50"
          >
            {TIE_HANDLING.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-text">
          Mulligans allowed
          <input
            type="number"
            min={0}
            value={rules.mulligans_allowed}
            onChange={(event) => setRules({ ...rules, mulligans_allowed: Number(event.target.value) })}
            disabled={locked}
            className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none disabled:opacity-50"
          />
          <span className="text-xs text-brand-muted">
            An entry that would be eliminated automatically survives on a mulligan, up to this many times.
          </span>
        </label>

        <div className="flex flex-col gap-1 text-sm text-brand-text">
          Double-pick weeks
          <div className="flex flex-wrap gap-1">
            {weeks.map((w) => (
              <button
                key={w.weekNumber}
                type="button"
                disabled={locked}
                onClick={() => toggleDoublePickWeek(w.weekNumber)}
                className={`rounded px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  rules.double_pick_weeks.includes(w.weekNumber)
                    ? "bg-brand-accent text-white"
                    : "bg-brand-surface-raised text-brand-muted hover:text-brand-text"
                }`}
              >
                {w.weekNumber}
              </button>
            ))}
          </div>
          <span className="text-xs text-brand-muted">
            Entries submit two picks in these weeks — eliminated if either loses.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={locked}
            className="rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={toggleLock}
            className="rounded border border-brand-border px-3 py-2 font-display font-semibold text-brand-text hover:border-brand-accent"
          >
            {locked ? "Unlock" : "Lock"}
          </button>
        </div>
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="rounded border border-red-900 bg-red-950/40 p-4">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-red-400">
          Danger zone
        </h2>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="rounded border border-red-800 px-3 py-2 font-display text-sm font-semibold text-red-400 hover:bg-red-950"
        >
          Delete pool
        </button>
      </div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <DeletePoolForm pool={pool} onClose={() => setShowDeleteModal(false)} onDeleted={onDeleted} />
      </Modal>
    </div>
  );
}

function DeletePoolForm({
  pool,
  onClose,
  onDeleted,
}: {
  pool: Pool;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/pools/${pool.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm_name: confirmName }),
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete pool");
    }
  }

  return (
    <form onSubmit={remove} className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-red-400">Delete pool</h2>
      <p className="text-sm text-brand-text">
        This permanently deletes <span className="font-semibold">{pool.name}</span> and every entry and pick
        in it. Type the pool name to confirm.
      </p>
      <input
        value={confirmName}
        onChange={(event) => setConfirmName(event.target.value)}
        placeholder={pool.name}
        className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={confirmName !== pool.name}
          className="rounded bg-red-700 px-3 py-2 font-display font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-brand-border px-3 py-2 font-display font-semibold text-brand-text hover:border-brand-accent"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
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
