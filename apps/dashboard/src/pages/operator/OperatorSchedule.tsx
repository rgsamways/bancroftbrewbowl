import { useState } from "react";
import { Link } from "react-router";
import { formatKickoff } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { teamNickname } from "../../lib/teams";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";

type Preview = {
  seasonYear: number;
  weeks: { week: number; toAdd: number; moved: number }[];
  totals: { toAdd: number; moved: number; unchanged: number };
  moved: { week: number; homeTeam: string; awayTeam: string; from: string; to: string }[];
};
type Outcome = { added: number; moved: unknown[] };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Load a season's NFL schedule from ESPN: preview first, nothing changes until Load. New games
 * start undecided, and a game that has started or has a result is never touched. */
export function OperatorSchedule() {
  const year = new Date().getFullYear();
  const [season, setSeason] = useState(year);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    setOutcome(null);
    setPreview(null);
    try {
      setPreview(await api<Preview>(`/operator/schedule?season=${season}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setOutcome(await api<Outcome>("/operator/schedule", { method: "POST", body: JSON.stringify({ season }) }));
      setPreview(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  const nothing = preview && preview.totals.toAdd === 0 && preview.totals.moved === 0;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Schedule</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Loads a season's regular-season games from ESPN. New games start undecided. Games that have started, and results, are never changed.
          Results come from Check for results.
        </p>
      </div>

      <label className="block text-sm font-semibold text-brand-text">
        Season
        <select value={season} onChange={(e) => { setSeason(Number(e.target.value)); setPreview(null); setOutcome(null); }} className={`${inputClass} mt-1`}>
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => void check()} disabled={busy} className={secondaryButtonClass}>
        {busy && !preview ? "Checking ESPN..." : "See what would change"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}
      {outcome && (
        <p role="status" className="text-sm text-emerald-400">
          Done. Added {plural(outcome.added, "game")} and updated {plural(outcome.moved.length, "kickoff")}.
        </p>
      )}

      {nothing && <p className="text-sm text-brand-text">The {preview.seasonYear} schedule is already up to date.</p>}

      {preview && !nothing && (
        <section className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <p className="font-semibold text-brand-text">
            {plural(preview.totals.toAdd, "game")} to add, {plural(preview.totals.moved, "kickoff")} to update
          </p>
          <p className="text-sm text-brand-muted">{preview.totals.unchanged} games are already up to date.</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-muted">
            {preview.weeks.map((w) => (
              <li key={w.week}>
                Week {w.week}: {w.toAdd > 0 ? `${plural(w.toAdd, "game")} to add` : ""}
                {w.toAdd > 0 && w.moved > 0 ? ", " : ""}
                {w.moved > 0 ? `${plural(w.moved, "kickoff")} to update` : ""}
              </li>
            ))}
          </ul>
          {preview.moved.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-brand-border pt-3 text-sm text-brand-muted">
              {preview.moved.map((m) => (
                <li key={`${m.week}-${m.homeTeam}`}>
                  Week {m.week}: {teamNickname(m.awayTeam)} at {teamNickname(m.homeTeam)} now {formatKickoff(m.to)} (was {formatKickoff(m.from)})
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => void load()} disabled={busy} className={`${buttonClass} mt-4`}>
            {busy ? "Loading..." : `Load the ${preview.seasonYear} schedule`}
          </button>
        </section>
      )}

      <Link to="/admin/more" className={secondaryButtonClass}>
        Back to More
      </Link>
    </div>
  );
}
