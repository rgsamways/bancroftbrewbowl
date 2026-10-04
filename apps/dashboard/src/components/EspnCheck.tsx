import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { teamNickname } from "../lib/teams";

type Finished = {
  gameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  result: "home_win" | "away_win" | "tie";
  homeScore: number | null;
  awayScore: number | null;
};
type Differs = {
  gameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  enteredResult: "home_win" | "away_win" | "tie";
  espnResult: "home_win" | "away_win" | "tie";
};
type Preview = { finished: Finished[]; differs: Differs[] };
type Applied = { applied: { gameId: string }[]; skipped: { gameId: string }[]; wipeout: boolean };

const line = (g: { homeTeam: string; awayTeam: string }, r: "home_win" | "away_win" | "tie", scores?: [number | null, number | null]) => {
  const score = scores && scores[0] !== null && scores[1] !== null ? ` ${scores[0]}-${scores[1]}` : "";
  const who = r === "home_win" ? `${teamNickname(g.homeTeam)} won` : r === "away_win" ? `${teamNickname(g.awayTeam)} won` : "Tie";
  return `${teamNickname(g.awayTeam)} at ${teamNickname(g.homeTeam)}: ${who}${score}`;
};

/** "Check for results": asks ESPN what has finished, shows it, and saves it only on Apply.
 * Entering results by hand below stays available whatever happens here. */
export function EspnCheck({ onApplied }: { onApplied: (info: { wipeout: boolean }) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setPreview(null);
    try {
      setPreview(await api<Preview>("/admin/results/espn"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't check ESPN right now. You can still enter results by hand below.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<Applied>("/admin/results/espn/apply", {
        method: "POST",
        body: JSON.stringify({ gameIds: preview.finished.map((g) => g.gameId) }),
      });
      const skipped = res.skipped.length > 0 ? ` ${res.skipped.length} skipped because they changed meanwhile.` : "";
      setNotice(`Saved ${res.applied.length} result${res.applied.length === 1 ? "" : "s"}.${skipped}`);
      setPreview(null);
      onApplied({ wipeout: res.wipeout });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-[14px] border border-brand-border bg-brand-surface p-4";
  return (
    <section aria-label="Check for results" className={card}>
      <h2 className="font-semibold text-brand-text">Check for results</h2>
      <p className="mt-1 text-sm text-brand-muted">Looks up finished games on ESPN. Nothing is saved until you confirm.</p>

      {!preview && (
        <button
          type="button"
          onClick={() => void check()}
          disabled={busy}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent disabled:opacity-40"
        >
          {busy ? "Checking..." : "Check for results"}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-emerald-400">
          {notice}
        </p>
      )}

      {preview && preview.finished.length === 0 && (
        <div className="mt-3">
          <p className="text-sm text-brand-text">Nothing new to apply.</p>
          <button type="button" onClick={() => setPreview(null)} className="mt-2 min-h-11 text-sm font-semibold text-brand-accent">
            Done
          </button>
        </div>
      )}

      {preview && preview.finished.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-brand-text">
            {preview.finished.length} game{preview.finished.length === 1 ? "" : "s"} finished
          </p>
          <ul className="mt-2 space-y-1 text-sm text-brand-muted">
            {preview.finished.map((g) => (
              <li key={g.gameId}>
                Week {g.week}: {line(g, g.result, [g.homeScore, g.awayScore])}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40"
          >
            {busy ? "Saving..." : `Apply ${preview.finished.length} result${preview.finished.length === 1 ? "" : "s"}`}
          </button>
          <button type="button" onClick={() => setPreview(null)} disabled={busy} className="mt-1 min-h-11 text-sm font-semibold text-brand-muted">
            Cancel
          </button>
        </div>
      )}

      {preview && preview.differs.length > 0 && (
        <div className="mt-3 border-t border-brand-border pt-3">
          <p className="text-sm font-semibold text-amber-400">Different from what you entered (not changed)</p>
          <ul className="mt-1 space-y-1 text-sm text-brand-muted">
            {preview.differs.map((g) => (
              <li key={g.gameId}>
                Week {g.week}: {teamNickname(g.awayTeam)} at {teamNickname(g.homeTeam)}. You entered: {line(g, g.enteredResult).split(": ")[1]}.
                ESPN says: {line(g, g.espnResult).split(": ")[1]}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
