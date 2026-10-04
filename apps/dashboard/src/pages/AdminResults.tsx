import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatKickoff, type AdminSummary } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useServerNow } from "../lib/useServerClock";
import { teamNickname } from "../lib/teams";
import { EspnCheck } from "../components/EspnCheck";

type Result = "pending" | "home_win" | "away_win" | "tie";
type AdminGameRow = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  result: Result;
  homeScore: number | null;
  awayScore: number | null;
};
type Week = { weekNumber: number };
type ScoreResponse = { scoring: { poolId: string; wipeout: boolean }[] };

const winnerButton =
  "flex min-h-12 flex-1 items-center justify-center rounded-[12px] border border-brand-border px-2 text-center text-sm font-semibold text-brand-text hover:border-brand-accent disabled:opacity-40";

export const teamLabel = (code: string) => `${code} ${teamNickname(code)}`;

export function resultSentence(g: Pick<AdminGameRow, "homeTeam" | "awayTeam" | "homeScore" | "awayScore">, r: Result) {
  const score = g.homeScore !== null && g.awayScore !== null ? ` ${g.homeScore}–${g.awayScore}` : "";
  if (r === "home_win") return `${teamNickname(g.homeTeam)} won${score}`;
  if (r === "away_win") return `${teamNickname(g.awayTeam)} won${score}`;
  if (r === "tie") return `Tie${score}`;
  return "Not entered";
}

/** The three buttons for a game: away team won, tie, home team won. */
export function ResultButtons({
  game,
  current,
  busy,
  onPick,
}: {
  game: Pick<AdminGameRow, "homeTeam" | "awayTeam">;
  current?: Result;
  busy: boolean;
  onPick: (r: Exclude<Result, "pending">) => void;
}) {
  return (
    <div className="mt-2 flex gap-2">
      <button type="button" disabled={busy || current === "away_win"} onClick={() => onPick("away_win")} className={winnerButton}>
        {teamLabel(game.awayTeam)} won
      </button>
      <button type="button" disabled={busy || current === "tie"} onClick={() => onPick("tie")} className={`${winnerButton} max-w-20`}>
        Tie
      </button>
      <button type="button" disabled={busy || current === "home_win"} onClick={() => onPick("home_win")} className={winnerButton}>
        {teamLabel(game.homeTeam)} won
      </button>
    </div>
  );
}

export function AdminResults() {
  const { data: summary, reload: reloadSummary } = useApi<AdminSummary>("/admin/summary");
  const nowMs = useServerNow(summary?.serverNow);
  const season = summary?.seasonYear ?? null;
  const { data: weeks } = useApi<Week[]>(season ? `/nfl/weeks?year=${season}` : "/nfl/weeks?year=0");

  const [week, setWeek] = useState<number | null>(null);
  const [games, setGames] = useState<AdminGameRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeout, setWipeout] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const weekNumbers = (weeks ?? []).map((w) => w.weekNumber);
  const shownWeek = week ?? summary?.weekNumber ?? (weekNumbers.length > 0 ? weekNumbers[weekNumbers.length - 1]! : null);

  const loadGames = useCallback(async () => {
    if (!season || shownWeek === null) return;
    try {
      setGames(await api<AdminGameRow[]>(`/nfl/games?year=${season}&week=${shownWeek}`));
    } catch {
      setMessage("We couldn't load the games. Check your connection and try again.");
    }
  }, [season, shownWeek]);

  useEffect(() => {
    setGames(null);
    setChanging(null);
    void loadGames();
  }, [loadGames]);

  async function enter(game: AdminGameRow, result: Exclude<Result, "pending">) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<ScoreResponse>(`/nfl/games/${game.id}/result`, { method: "POST", body: JSON.stringify({ result }) });
      if (res.scoring.some((s) => s.wipeout)) setWipeout(true);
      setChanging(null);
      await Promise.all([loadGames(), reloadSummary()]);
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. The result was not saved.`);
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return null;
  if (!summary.scheduleLoaded) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-4">
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Results</h1>
        <p className="mt-3 text-sm text-brand-muted">
          There are no games loaded, so there's nothing to enter results for. The schedule is loaded once a season by the developer.
        </p>
      </div>
    );
  }

  const list = games ?? [];
  const kickedOff = (g: AdminGameRow) => Date.parse(g.kickoffTime) <= nowMs;
  const waiting = list.filter((g) => g.result === "pending" && kickedOff(g));
  const notPlayed = list.filter((g) => g.result === "pending" && !kickedOff(g));
  const done = list.filter((g) => g.result !== "pending");
  const waitingForWizard = shownWeek === summary.weekNumber && summary.waitingGames.length > 0;
  const idx = shownWeek === null ? -1 : weekNumbers.indexOf(shownWeek);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Results</h1>
        <p className="mt-1 text-sm text-brand-muted">Tap the winner as each game finishes.</p>
      </div>

      {wipeout && (
        <Link to="/admin" className="block rounded-[14px] border border-amber-500/50 bg-brand-surface p-4 text-sm text-brand-text">
          <span className="font-semibold text-amber-400">Needs your attention.</span> That result would knock out every player left in a
          pool. Nothing has been applied yet. Tap to decide.
        </Link>
      )}
      {message && (
        <p role="alert" className="text-sm text-brand-danger">
          {message}
        </p>
      )}

      <EspnCheck
        onApplied={async ({ wipeout: held }) => {
          if (held) setWipeout(true);
          await Promise.all([loadGames(), reloadSummary()]);
        }}
      />

      {waitingForWizard && (
        <Link
          to="/admin/results/steps"
          className="flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover"
        >
          Do it game by game
        </Link>
      )}

      <div className="flex items-center justify-between rounded-[14px] border border-brand-border bg-brand-surface p-2">
        <button
          type="button"
          aria-label="Previous week"
          disabled={idx <= 0}
          onClick={() => setWeek(weekNumbers[idx - 1]!)}
          className="grid h-11 w-11 place-items-center rounded-full text-brand-text disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-brand-text">Week {shownWeek}</p>
          <p className="text-xs text-brand-muted">
            {season} season &middot; {done.length} of {list.length} entered
            {waiting.length > 0 ? `, ${waiting.length} to go` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next week"
          disabled={idx < 0 || idx >= weekNumbers.length - 1}
          onClick={() => setWeek(weekNumbers[idx + 1]!)}
          className="grid h-11 w-11 place-items-center rounded-full text-brand-text disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p className="text-xs text-brand-faint">
        Results count in every pool this season, so you only enter each one once.
      </p>

      {games === null ? null : (
        <>
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-brand-muted">Waiting for a result</h2>
              <ul className="space-y-3">
                {waiting.map((g) => (
                  <li key={g.id} className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
                    <p className="text-xs text-brand-faint">{formatKickoff(g.kickoffTime)}</p>
                    <p className="font-semibold text-brand-text">
                      {teamNickname(g.awayTeam)} @ {teamNickname(g.homeTeam)}
                    </p>
                    <ResultButtons game={g} busy={busy} onPick={(r) => void enter(g, r)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notPlayed.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-brand-muted">Not played yet</h2>
              <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                {notPlayed.map((g) => (
                  <li key={g.id} className="border-b border-brand-border px-4 py-3 last:border-b-0">
                    <p className="font-semibold text-brand-text">
                      {teamNickname(g.awayTeam)} @ {teamNickname(g.homeTeam)}
                    </p>
                    <p className="text-sm text-brand-muted">Kicks off {formatKickoff(g.kickoffTime)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-brand-muted">Done {done.length}</h2>
              <ul className="space-y-3">
                {(showAllDone ? done : done.slice(0, 6)).map((g) => (
                  <li key={g.id} className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-text">
                          {teamNickname(g.awayTeam)} @ {teamNickname(g.homeTeam)}
                        </p>
                        <p className="text-sm text-brand-muted">
                          {resultSentence(g, g.result)} &middot; Final
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChanging(changing === g.id ? null : g.id)}
                        className="min-h-11 flex-none rounded-[12px] border border-brand-border px-4 text-sm font-semibold text-brand-text hover:border-brand-accent"
                      >
                        Change
                      </button>
                    </div>
                    {changing === g.id && (
                      <div className="mt-3 border-t border-brand-border pt-3">
                        <p className="font-semibold text-brand-text">Change this result?</p>
                        <p className="mt-1 text-sm text-brand-muted">
                          {teamNickname(g.awayTeam)} @ {teamNickname(g.homeTeam)}: you entered {resultSentence(g, g.result)}.
                        </p>
                        <div className="mt-3 rounded-[12px] border border-amber-500/40 p-3 text-sm text-brand-muted">
                          <p className="font-semibold text-amber-400">Check the roster afterwards</p>
                          <p>
                            {summary.hasSurvivorPool
                              ? "In Survivor pools, players this result already knocked out are not brought back automatically. Fix them on the roster. "
                              : ""}
                            Pick 'Em points update by themselves.
                          </p>
                        </div>
                        <ResultButtons game={g} current={g.result} busy={busy} onPick={(r) => void enter(g, r)} />
                        <button
                          type="button"
                          onClick={() => setChanging(null)}
                          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border text-sm font-semibold text-brand-text"
                        >
                          Keep it as it is
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!showAllDone && done.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllDone(true)}
                  className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[12px] border border-brand-border text-sm font-semibold text-brand-text"
                >
                  Show all {done.length}
                </button>
              )}
            </section>
          )}

          {list.length === 0 && <p className="text-sm text-brand-muted">No games in this week.</p>}
        </>
      )}
    </div>
  );
}
