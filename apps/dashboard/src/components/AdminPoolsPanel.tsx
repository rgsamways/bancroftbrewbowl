import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { TIE_HANDLING, type RulesConfig } from "@bbb/shared";
import { api } from "../lib/api";
import type { Week } from "./WeekWidgets";

type Pool = { id: string; name: string; seasonYear: number; status: string; rules: RulesConfig };

export function CreatePoolPanel() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [seasons, setSeasons] = useState<number[]>([new Date().getFullYear()]);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then((fetched) => {
      if (fetched.length === 0) return;
      setSeasons(fetched);
      setSeasonYear(Math.max(...fetched));
    });
  }, []);

  async function createPool(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const pool = await api<Pool>("/pools", {
        method: "POST",
        body: JSON.stringify({ name, season_year: seasonYear }),
      });
      setName("");
      navigate(`/admin/${pool.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create pool");
    }
  }

  return (
    <form
      onSubmit={createPool}
      className="flex flex-col gap-3 rounded border border-brand-border bg-brand-surface p-4"
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Create a pool
      </h2>
      <input
        placeholder="Pool name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
      />
      <select
        value={seasonYear}
        onChange={(event) => setSeasonYear(Number(event.target.value))}
        className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
      >
        {seasons.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover"
      >
        Create
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

export function PoolRulesPanel({ poolId }: { poolId: string }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRules(null);
    setSaved(false);
    setError(null);
    api<Pool>(`/pools/${poolId}`).then((fetched) => {
      setPool(fetched);
      setRules(fetched.rules);
    });
  }, [poolId]);

  useEffect(() => {
    if (!pool) return;
    api<Week[]>(`/nfl/weeks?year=${pool.seasonYear}`).then(setWeeks);
  }, [pool]);

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
      const updated = await api<Pool>(`/pools/${poolId}/rules`, {
        method: "PATCH",
        body: JSON.stringify(rules),
      });
      setPool(updated);
      setRules(updated.rules);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  }

  if (!rules) return null;

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded border border-brand-border bg-brand-surface p-4"
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">Rules</h2>

      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input
          type="checkbox"
          checked={rules.allow_repeat_teams}
          onChange={(event) => setRules({ ...rules, allow_repeat_teams: event.target.checked })}
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
          className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
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
          className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
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
              onClick={() => toggleDoublePickWeek(w.weekNumber)}
              className={`rounded px-3 py-1 text-sm font-medium ${
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

      <button
        type="submit"
        className="self-start rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover"
      >
        Save
      </button>
      {saved && <p className="text-sm text-emerald-400">Saved.</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
