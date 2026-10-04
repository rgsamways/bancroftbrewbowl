import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { dayHeading, formatKickoffTime, type AdminGame, type AdminSummary } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";
import { FocusBar } from "../components/AdminLayout";
import { teamLabel } from "./AdminResults";

type ScoreResponse = { scoring: { poolId: string; wipeout: boolean }[] };

const big =
  "flex min-h-14 w-full items-center justify-center rounded-[14px] border border-brand-border bg-brand-surface px-4 text-lg font-semibold text-brand-text hover:border-brand-accent disabled:opacity-40";

/** Enter the results that are waiting, one game at a time. Each answer saves straight away. */
export function ResultsWizard() {
  const navigate = useNavigate();
  const { data: summary } = useApi<AdminSummary>("/admin/summary");
  // The games to walk through are fixed when the screen opens, so the list does not shift under
  // the admin as results are saved.
  const [queue, setQueue] = useState<AdminGame[] | null>(null);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [wipeouts, setWipeouts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (summary && queue === null) setQueue(summary.waitingGames);
  }, [summary, queue]);

  if (!queue) return null;

  if (queue.length === 0) {
    return (
      <>
        <FocusBar leaveTo="/admin/results" />
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-brand-text">No results waiting</h1>
        <p className="mt-2 text-sm text-brand-muted">Every game that has kicked off has a result.</p>
        <Link to="/admin" className={`${big} mt-6`}>
          Back to your steps
        </Link>
      </>
    );
  }

  if (index >= queue.length) {
    return (
      <>
        <FocusBar leaveTo="/admin" />
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-brand-text">
          {skipped === 0 ? `All ${saved} ${saved === 1 ? "result is" : "results are"} in` : `${saved} saved, ${skipped} still waiting`}
        </h1>
        {wipeouts > 0 ? (
          <div className="mt-4 rounded-[14px] border border-amber-500/50 bg-brand-surface p-4">
            <p className="font-semibold text-amber-400">Needs your attention</p>
            <p className="mt-1 text-sm text-brand-muted">
              {wipeouts === 1 ? "A pool needs" : `${wipeouts} pools need`} a decision: a result would knock out every player left.
              Nothing has been applied yet.
            </p>
            <Link to="/admin" className={`${big} mt-3 !bg-brand-accent !text-brand-accent-ink`}>
              Decide now
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-brand-muted">
            Standings are up to date. No pool needs a decision from you.
          </p>
        )}
        {skipped > 0 && <p className="mt-3 text-sm text-brand-muted">Skipped games stay on your list until you enter them.</p>}
        <Link to="/admin" className={`${big} mt-6`}>
          Back to your steps
        </Link>
      </>
    );
  }

  const game = queue[index]!;

  async function answer(result: "home_win" | "away_win" | "tie") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<ScoreResponse>(`/nfl/games/${game.id}/result`, { method: "POST", body: JSON.stringify({ result }) });
      setSaved((n) => n + 1);
      setWipeouts((n) => n + res.scoring.filter((s) => s.wipeout).length);
      setIndex((i) => i + 1);
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. That result was not saved, so try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FocusBar label={`Step ${index + 1} of ${queue.length}`} onBack={() => navigate("/admin/results")} leaveTo="/admin/results" />
      <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-text">Who won?</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Game {index + 1} of {queue.length} waiting for a result. Tap the winner.
      </p>

      <div className="mt-5 rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <p className="text-lg font-semibold text-brand-text">
          {teamNickname(game.awayTeam)} @ {teamNickname(game.homeTeam)}
        </p>
        <p className="text-sm text-brand-muted">
          {dayHeading(game.kickoffTime)} {formatKickoffTime(game.kickoffTime)}
        </p>
      </div>

      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}

      <div className="mt-5 space-y-3">
        <button type="button" disabled={busy} onClick={() => void answer("away_win")} className={big}>
          {teamLabel(game.awayTeam)} won
        </button>
        <button type="button" disabled={busy} onClick={() => void answer("home_win")} className={big}>
          {teamLabel(game.homeTeam)} won
        </button>
        <button type="button" disabled={busy} onClick={() => void answer("tie")} className={big}>
          It was a tie
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSkipped((n) => n + 1);
            setIndex((i) => i + 1);
          }}
          className="flex min-h-12 w-full items-center justify-center text-sm font-semibold text-brand-muted"
        >
          Skip this one for now
        </button>
      </div>
      <p className="mt-6 text-xs text-brand-faint">
        Your answer counts in every pool this season, so you only do this once per game.
      </p>
    </>
  );
}
