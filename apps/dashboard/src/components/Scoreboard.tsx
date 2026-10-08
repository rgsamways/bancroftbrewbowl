import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatKickoff,
  formatKickoffTime,
  scoreboardPollMs,
  type Scoreboard as ScoreboardData,
  type ScoreboardGame,
  type ScoreboardResponse,
} from "@bbb/shared";
import { api } from "../lib/api";
import { teamCircleStyle, teamNickname } from "../lib/teams";

const SHOWN = 6;

/** The NFL scoreboard on Home: live games first, then what is coming, then finals. It looks after
 * its own refreshing (quick while a game is live, slow otherwise, paused in a background tab) and
 * simply is not there when there is nothing to show. */
export function Scoreboard() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [showAll, setShowAll] = useState(false);
  const latest = useRef<ScoreboardData | null>(null);
  latest.current = data;

  const load = useCallback(async () => {
    try {
      const res = await api<ScoreboardResponse>("/me/scoreboard");
      setData(res.scoreboard);
    } catch {
      // Keep what is on screen; the scoreboard is a nicety and never shows an error.
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => void tick(), scoreboardPollMs(latest.current?.games ?? []));
    };
    const tick = async () => {
      if (!document.hidden) await load();
      schedule();
    };
    const onVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (!data || data.games.length === 0) return null;

  const pickPools = new Map<string, string[]>();
  for (const p of data.yourPicks) for (const team of p.teams) pickPools.set(team, [...(pickPools.get(team) ?? []), p.poolName]);
  const manyPools = data.yourPicks.length > 1;
  const shown = showAll ? data.games : data.games.slice(0, SHOWN);

  return (
    <section aria-label="NFL scoreboard">
      <h2 className="mb-2 text-sm font-semibold text-brand-muted">NFL scoreboard &middot; Week {data.weekNumber}</h2>
      <ul className="space-y-3">
        {shown.map((game) => (
          <GameRow key={`${game.awayTeam}-${game.homeTeam}`} game={game} pickPools={pickPools} manyPools={manyPools} />
        ))}
      </ul>
      {data.games.length > SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[12px] border border-brand-border text-sm font-semibold text-brand-text hover:border-brand-accent"
        >
          {showAll ? "Show fewer" : `Show all ${data.games.length} games`}
        </button>
      )}
      {data.byes.length > 0 && <p className="mt-3 text-sm text-brand-muted">On a bye: {data.byes.map(teamNickname).join(", ")}</p>}
      <p className="mt-2 text-xs text-brand-faint">
        {data.stale
          ? `Last updated ${formatKickoffTime(data.asOf)}. ESPN isn't answering right now.`
          : `Updated ${formatKickoffTime(data.asOf)}. Scores can lag a little.`}
      </p>
    </section>
  );
}

function GameRow({ game, pickPools, manyPools }: { game: ScoreboardGame; pickPools: Map<string, string[]>; manyPools: boolean }) {
  const live = game.state === "live";
  const label = game.state === "upcoming" && !game.statusText ? formatKickoff(game.kickoff) : game.statusText || "Final";
  const final = game.state === "final";
  const hasScore = game.homeScore !== null && game.awayScore !== null;
  const winner = final && hasScore ? (game.homeScore! > game.awayScore! ? game.homeTeam : game.awayScore! > game.homeScore! ? game.awayTeam : null) : null;

  return (
    <li data-testid="scoreboard-game" data-state={game.state} className="rounded-[14px] border border-brand-border bg-brand-surface px-4 py-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={live ? "flex items-center gap-1.5 font-semibold text-brand-accent" : "text-brand-faint"}>
          {live && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-accent" />}
          {label}
        </span>
        {game.network && <span className="text-brand-faint">{game.network}</span>}
      </div>
      {[
        { team: game.awayTeam, score: game.awayScore, record: game.awayRecord },
        { team: game.homeTeam, score: game.homeScore, record: game.homeRecord },
      ].map((side) => {
        const pools = pickPools.get(side.team);
        return (
          <div key={side.team}>
            <div className="flex min-h-9 items-center gap-2.5">
              <span
                aria-hidden="true"
                style={teamCircleStyle(side.team)}
                className="grid h-6 w-6 flex-none place-items-center rounded-full text-[9px] font-bold"
              >
                {side.team}
              </span>
              <span className={`min-w-0 truncate text-sm ${winner === side.team || !final ? "font-semibold text-brand-text" : "text-brand-muted"}`}>
                {teamNickname(side.team)}
              </span>
              {side.record && <span className="text-xs text-brand-faint">{side.record}</span>}
              <span
                data-testid="scoreboard-score"
                className={`ml-auto text-lg tabular-nums ${winner === side.team || (!final && live) ? "font-semibold text-brand-text" : "text-brand-muted"}`}
              >
                {side.score !== null ? side.score : ""}
              </span>
            </div>
            {pools && (
              // On its own line under the team, so a long list of pool names never squeezes the team name.
              <p className="mb-1 ml-[34px]">
                <span className="inline-block rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">
                  Your pick{manyPools ? ` · ${pools.join(", ")}` : ""}
                </span>
              </p>
            )}
          </div>
        );
      })}
    </li>
  );
}
