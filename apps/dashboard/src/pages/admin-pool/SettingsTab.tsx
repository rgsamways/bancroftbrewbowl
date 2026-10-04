import { useState } from "react";
import { useNavigate } from "react-router";
import {
  PICK_EM_TIE_HANDLING,
  REVEAL_PICKS,
  type RevealPicks,
  TIE_HANDLING,
  parsePoolTotal,
  poolTotalToInput,
  type PickEmRulesConfig,
  type SurvivorRulesConfig,
} from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass, type PoolRow } from "./shared";

const label = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function PoolTotalForm({ pool, onSaved }: { pool: PoolRow; onSaved: (pool: PoolRow) => void }) {
  const [text, setText] = useState(poolTotalToInput(pool.poolTotalCents));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const parsed = parsePoolTotal(text);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await api<PoolRow>(`/pools/${pool.id}`, { method: "PATCH", body: JSON.stringify({ pool_total_cents: parsed.cents }) });
      onSaved(updated);
      setText(poolTotalToInput(updated.poolTotalCents));
      setSaved(true);
    } catch {
      setError("The pool total was not saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <h2 className="font-semibold text-brand-text">Pool total</h2>
      <label className="block text-sm font-semibold text-brand-text">
        Shown to players on Standings
        <div className="mt-1 flex items-center gap-2">
          <span aria-hidden="true" className="text-brand-muted">
            $
          </span>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={error ? true : undefined} className={inputClass} />
        </div>
      </label>
      <p className="text-xs text-brand-muted">
        You type this in. The app only shows it and never handles money. You can change it any time, even while the rules are locked.
        Leave it empty to hide it.
      </p>
      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-emerald-400">Saved.</p>}
      <button type="submit" disabled={busy} className={buttonClass}>
        Save pool total
      </button>
    </form>
  );
}

function DeleteSection({ pool }: { pool: PoolRow }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/pools/${pool.id}`, { method: "DELETE", body: JSON.stringify({ confirm_name: typed }) });
      navigate("/admin/pools", { replace: true });
    } catch (e) {
      setError(`${errorText(e, "Something went wrong")}. Nothing was deleted.`);
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-[14px] border border-red-900 bg-red-950/30 p-4">
      <h2 className="font-semibold text-red-400">Delete this pool</h2>
      {!open ? (
        <>
          <p className="text-sm text-brand-muted">Removes the pool, its players and all their picks for good.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-12 w-full items-center justify-center rounded-[12px] border border-red-800 px-4 font-semibold text-red-400 hover:bg-red-950"
          >
            Delete pool…
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-brand-text">Delete {pool.name}?</p>
          <p className="text-sm text-brand-muted">
            This permanently deletes the pool, its players and all their picks. It can't be undone. Type the pool's name to confirm.
          </p>
          <input
            aria-label="Type the pool's name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={pool.name}
            className={inputClass}
          />
          {error && (
            <p role="alert" className="text-sm text-brand-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy || typed !== pool.name}
            onClick={() => void remove()}
            className="flex min-h-12 w-full items-center justify-center rounded-[12px] bg-red-700 px-4 font-semibold text-white disabled:opacity-40"
          >
            Delete pool
          </button>
          <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
            Cancel
          </button>
        </>
      )}
    </section>
  );
}

export function SettingsTab({ pool, onChanged }: { pool: PoolRow; onChanged: (pool: PoolRow) => void }) {
  const locked = pool.status !== "draft";
  const { data: seasons } = useApi<number[]>("/nfl/seasons");
  const { data: weeks } = useApi<{ weekNumber: number }[]>(`/nfl/weeks?year=${pool.seasonYear}`);
  const [name, setName] = useState(pool.name);
  const [season, setSeason] = useState(pool.seasonYear);
  const [rules, setRules] = useState<SurvivorRulesConfig | PickEmRulesConfig>(pool.rules);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seasonOptions = [...new Set([...(seasons ?? []), pool.seasonYear, season])].sort();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    setBusy(true);
    try {
      onChanged(await api<PoolRow>(`/pools/${pool.id}`, { method: "PATCH", body: JSON.stringify({ name, season_year: season, rules }) }));
      setSaved(true);
    } catch (e) {
      setError(`${errorText(e, "Failed to save")}`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      onChanged(await api<PoolRow>(`/pools/${pool.id}`, { method: "PATCH", body: JSON.stringify({ status: locked ? "draft" : "active" }) }));
    } catch (e) {
      setError(errorText(e, "Couldn't change the lock"));
    } finally {
      setBusy(false);
    }
  }

  function toggleDoublePick(week: number) {
    setRules((current) => {
      if (!("double_pick_weeks" in current)) return current;
      const has = current.double_pick_weeks.includes(week);
      return { ...current, double_pick_weeks: has ? current.double_pick_weeks.filter((w) => w !== week) : [...current.double_pick_weeks, week].sort((a, b) => a - b) };
    });
  }

  const fieldLabel = "block text-sm font-semibold text-brand-text";

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <h2 className="font-semibold text-brand-text">{locked ? "Rules are locked" : "Rules are unlocked"}</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {locked
            ? "Players are picking, so the name, season and rules can't change. Unlock to edit them."
            : "You can change the name, season and rules until you lock them."}
        </p>
        <button type="button" disabled={busy} onClick={() => void toggleLock()} className={`${locked ? secondaryButtonClass : buttonClass} mt-3`}>
          {locked ? "Unlock the rules" : "Lock the rules"}
        </button>
      </section>

      <form onSubmit={save} className="space-y-4">
        <label className={fieldLabel}>
          Name
          <input value={name} required disabled={locked} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className={fieldLabel}>
          Season
          <select value={season} disabled={locked} onChange={(e) => setSeason(Number(e.target.value))} className={`${inputClass} mt-1`}>
            {seasonOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        {pool.type === "survivor" && "allow_repeat_teams" in rules && (
          <>
            <label className={fieldLabel}>
              Tied game counts as
              <select
                value={rules.tie_counts_as}
                disabled={locked}
                onChange={(e) => setRules({ ...rules, tie_counts_as: e.target.value as SurvivorRulesConfig["tie_counts_as"] })}
                className={`${inputClass} mt-1`}
              >
                {TIE_HANDLING.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-brand-text">
              <input
                type="checkbox"
                checked={rules.allow_repeat_teams}
                disabled={locked}
                onChange={(e) => setRules({ ...rules, allow_repeat_teams: e.target.checked })}
                className="h-5 w-5 accent-brand-accent"
              />
              Allow the same team twice
            </label>
            <label className={fieldLabel}>
              Extra lives
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={rules.mulligans_allowed}
                disabled={locked}
                onChange={(e) => setRules({ ...rules, mulligans_allowed: Number(e.target.value) })}
                className={`${inputClass} mt-1`}
              />
              <span className="mt-1 block text-xs font-normal text-brand-muted">0 means off. Players aren't shown lives.</span>
            </label>
            <fieldset>
              <legend className={fieldLabel}>Double-pick weeks</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {(weeks ?? []).map((w) => (
                  <button
                    key={w.weekNumber}
                    type="button"
                    disabled={locked}
                    aria-pressed={rules.double_pick_weeks.includes(w.weekNumber)}
                    onClick={() => toggleDoublePick(w.weekNumber)}
                    className={`h-11 min-w-11 rounded-[10px] px-2 text-sm font-semibold disabled:opacity-50 ${
                      rules.double_pick_weeks.includes(w.weekNumber) ? "bg-brand-accent text-brand-accent-ink" : "bg-brand-surface-raised text-brand-muted"
                    }`}
                  >
                    {w.weekNumber}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-brand-muted">Players pick two teams in these weeks. If either loses, they're out.</p>
            </fieldset>
          </>
        )}

        {pool.type === "pick_em" && "tie_handling" in rules && (
          <label className={fieldLabel}>
            Tied game counts as
            <select
              value={rules.tie_handling}
              disabled={locked}
              onChange={(e) => setRules({ ...rules, tie_handling: e.target.value as PickEmRulesConfig["tie_handling"] })}
              className={`${inputClass} mt-1`}
            >
              {PICK_EM_TIE_HANDLING.map((v) => (
                <option key={v} value={v}>
                  {v === "void" ? "No point for anyone" : "A point for everyone who picked either team"}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={fieldLabel}>
          When other players' picks show
          <select
            value={rules.reveal_picks ?? "at_lock"}
            disabled={locked}
            onChange={(e) => setRules({ ...rules, reveal_picks: e.target.value as RevealPicks })}
            className={`${inputClass} mt-1`}
          >
            {REVEAL_PICKS.map((v) => (
              <option key={v} value={v}>
                {v === "at_lock" ? "When the week locks" : "After the week's last game is final"}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-brand-muted">
            {(rules.reveal_picks ?? "at_lock") === "at_lock"
              ? "Once the first game kicks off, everyone can see everyone's picks."
              : "Picks stay private all weekend, until every game of the week has a result."}
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-brand-danger">
            {error}
          </p>
        )}
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}
        {!locked && (
          <button type="submit" disabled={busy} className={buttonClass}>
            Save changes
          </button>
        )}
      </form>

      <div className="border-t border-brand-border pt-4">
        <PoolTotalForm key={pool.id} pool={pool} onSaved={onChanged} />
      </div>

      <DeleteSection pool={pool} />
    </div>
  );
}
