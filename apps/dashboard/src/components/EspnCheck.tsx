import { useState } from "react";
import { formatKickoff } from "@bbb/shared";
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
type Moved = { gameId: string; week: number; homeTeam: string; awayTeam: string; from: string; to: string };
type Preview = { finished: Finished[]; differs: Differs[]; moved: Moved[] };
type Applied = { applied: { gameId: string }[]; skipped: { gameId: string }[]; moved: { gameId: string }[]; wipeout: boolean };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
        body: JSON.stringify({ gameIds: preview.finished.map((g) => g.gameId), movedIds: preview.moved.map((g) => g.gameId) }),
      });
      const skippedCount = res.skipped.length;
      const skipped = skippedCount > 0 ? ` ${skippedCount} skipped because they changed meanwhile.` : "";
      const moved = res.moved.length > 0 ? ` Updated ${plural(res.moved.length, "game time")}.` : "";
      setNotice(`${res.applied.length > 0 ? `Saved ${plural(res.applied.length, "result")}.` : "No results to save."}${moved}${skipped}`);
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

      {preview && preview.finished.length === 0 && preview.moved.length === 0 && (
        <div className="mt-3">
          <p className="text-sm text-brand-text">Nothing new to apply.</p>
          <button type="button" onClick={() => setPreview(null)} className="mt-2 min-h-11 text-sm font-semibold text-brand-accent">
            Done
          </button>
        </div>
      )}

      {preview && (preview.finished.length > 0 || preview.moved.length > 0) && (
        <div className="mt-3">
          {preview.finished.length > 0 && (
            <>
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
            </>
          )}
          {preview.moved.length > 0 && (
            <>
              <p className={`${preview.finished.length > 0 ? "mt-3 " : ""}text-sm font-semibold text-brand-text`}>
                {plural(preview.moved.length, "game")} moved
              </p>
              <ul className="mt-2 space-y-1 text-sm text-brand-muted">
                {preview.moved.map((g) => (
                  <li key={g.gameId}>
                    Week {g.week}: {teamNickname(g.awayTeam)} at {teamNickname(g.homeTeam)} now starts {formatKickoff(g.to)} (was{" "}
                    {formatKickoff(g.from)})
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40"
          >
            {busy
              ? "Saving..."
              : [
                  preview.finished.length > 0 ? plural(preview.finished.length, "result") : "",
                  preview.moved.length > 0 ? plural(preview.moved.length, "time change") : "",
                ]
                  .filter(Boolean)
                  .join(" and ")
                  .replace(/^/, "Apply ")}
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
