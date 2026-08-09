import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { NFL_TEAMS, type PoolType, type SurvivorRulesConfig } from "@bbb/shared";
import { api } from "../lib/api";

type Pool = { id: string; seasonYear: number; type: PoolType; rules: SurvivorRulesConfig };
type Week = { weekNumber: number; pickDeadline: string; locked: boolean };
type Pick = { weekNumber: number; teamCode: string; result: string };
type Game = { id: string; weekNumber: number; homeTeam: string; awayTeam: string; result: string };

export function PickScreen() {
  const { poolId, entryId } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);

  useEffect(() => {
    if (!poolId) return;
    api<Pool>(`/pools/${poolId}`).then((fetched) => {
      setPool(fetched);
      api<Week[]>(`/nfl/weeks?year=${fetched.seasonYear}`).then(setWeeks);
    });
  }, [poolId]);

  const currentWeek = useMemo(
    () => weeks.filter((w) => !w.locked).sort((a, b) => a.weekNumber - b.weekNumber)[0],
    [weeks]
  );

  if (!pool || !entryId) return null;
  if (!currentWeek) return <p className="p-6 text-brand-muted">No open week right now.</p>;

  return pool.type === "pick_em" ? (
    <PickEmPickScreen entryId={entryId} pool={pool} currentWeek={currentWeek} />
  ) : (
    <SurvivorPickScreen entryId={entryId} pool={pool} currentWeek={currentWeek} />
  );
}

function SurvivorPickScreen({ entryId, pool, currentWeek }: { entryId: string; pool: Pool; currentWeek: Week }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  function refreshPicks() {
    api<Pick[]>(`/entries/${entryId}/picks`).then(setPicks);
  }

  useEffect(refreshPicks, [entryId]);

  const limit = pool.rules.double_pick_weeks.includes(currentWeek.weekNumber) ? 2 : 1;
  const currentWeekPicks = picks.filter((p) => p.weekNumber === currentWeek.weekNumber);
  const otherWeekTeams = useMemo(
    () => new Set(picks.filter((p) => p.weekNumber !== currentWeek.weekNumber).map((p) => p.teamCode)),
    [picks, currentWeek]
  );

  async function pickTeam(teamCode: string) {
    setStatus(null);
    const alreadyPicked = currentWeekPicks.find((p) => p.teamCode === teamCode);
    try {
      if (alreadyPicked) {
        await api(`/entries/${entryId}/picks/${currentWeek.weekNumber}/${teamCode}`, { method: "DELETE" });
      } else {
        if (currentWeekPicks.length >= limit) {
          setStatus(`Remove a pick first — only ${limit} allowed this week.`);
          return;
        }
        await api(`/entries/${entryId}/picks`, {
          method: "POST",
          body: JSON.stringify({ week_number: currentWeek.weekNumber, team_code: teamCode }),
        });
      }
      refreshPicks();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to update pick");
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="font-display text-2xl font-bold text-brand-text">
        Week {currentWeek.weekNumber} pick{limit === 2 ? "s" : ""}
      </h1>
      {limit === 2 && (
        <p className="mt-1 text-sm text-brand-muted">
          Double-pick week — choose two teams. You're eliminated if either loses.
        </p>
      )}
      {currentWeekPicks.length > 0 && (
        <p className="mt-2 text-sm text-brand-muted">
          Current pick{currentWeekPicks.length > 1 ? "s" : ""}:{" "}
          {currentWeekPicks.map((p) => (
            <span key={p.teamCode} className="font-semibold text-brand-text">
              {p.teamCode}{" "}
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {NFL_TEAMS.map((team) => {
          const selected = currentWeekPicks.some((p) => p.teamCode === team.code);
          const disabled =
            !selected && (otherWeekTeams.has(team.code) || currentWeekPicks.length >= limit);
          return (
            <button
              key={team.code}
              disabled={disabled}
              onClick={() => pickTeam(team.code)}
              className={`rounded border px-2 py-2 text-sm font-medium ${
                selected
                  ? "border-brand-accent bg-brand-accent text-white"
                  : disabled
                    ? "cursor-not-allowed border-brand-border text-brand-muted/40"
                    : "border-brand-border bg-brand-surface text-brand-text hover:border-brand-accent"
              }`}
            >
              {team.code}
            </button>
          );
        })}
      </div>

      {status && <p className="mt-4 text-sm text-brand-text">{status}</p>}
    </div>
  );
}

function PickEmPickScreen({ entryId, pool, currentWeek }: { entryId: string; pool: Pool; currentWeek: Week }) {
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  function refreshPicks() {
    api<Pick[]>(`/entries/${entryId}/picks`).then(setPicks);
  }

  useEffect(() => {
    api<Game[]>(`/nfl/games?year=${pool.seasonYear}&week=${currentWeek.weekNumber}`).then(setGames);
    refreshPicks();
  }, [pool.seasonYear, currentWeek.weekNumber, entryId]);

  const pickedTeams = new Set(
    picks.filter((p) => p.weekNumber === currentWeek.weekNumber).map((p) => p.teamCode)
  );

  // Picking the opposing team when one side of this game is already picked
  // must replace it, not add a second row — otherwise the entry burns two
  // of its week's pick slots (one per game) on a single game.
  async function selectWinner(game: Game, teamCode: string) {
    setStatus(null);
    const otherTeam = teamCode === game.homeTeam ? game.awayTeam : game.homeTeam;
    const alreadyThis = pickedTeams.has(teamCode);
    try {
      if (alreadyThis) {
        await api(`/entries/${entryId}/picks/${currentWeek.weekNumber}/${teamCode}`, { method: "DELETE" });
      } else {
        if (pickedTeams.has(otherTeam)) {
          await api(`/entries/${entryId}/picks/${currentWeek.weekNumber}/${otherTeam}`, { method: "DELETE" });
        }
        await api(`/entries/${entryId}/picks`, {
          method: "POST",
          body: JSON.stringify({ week_number: currentWeek.weekNumber, team_code: teamCode }),
        });
      }
      refreshPicks();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to update pick");
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="font-display text-2xl font-bold text-brand-text">Week {currentWeek.weekNumber} picks</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Pick a winner for every game — {pickedTeams.size} of {games.length} picked.
      </p>

      <ul className="mt-4 divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {games.map((game) => {
          const awayPicked = pickedTeams.has(game.awayTeam);
          const homePicked = pickedTeams.has(game.homeTeam);
          return (
            <li key={game.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button
                onClick={() => selectWinner(game, game.awayTeam)}
                className={`flex-1 rounded border px-2 py-2 text-center font-medium ${
                  awayPicked
                    ? "border-brand-accent bg-brand-accent text-white"
                    : "border-brand-border bg-brand-bg text-brand-text hover:border-brand-accent"
                }`}
              >
                {game.awayTeam}
              </button>
              <span className="text-xs text-brand-muted">@</span>
              <button
                onClick={() => selectWinner(game, game.homeTeam)}
                className={`flex-1 rounded border px-2 py-2 text-center font-medium ${
                  homePicked
                    ? "border-brand-accent bg-brand-accent text-white"
                    : "border-brand-border bg-brand-bg text-brand-text hover:border-brand-accent"
                }`}
              >
                {game.homeTeam}
              </button>
            </li>
          );
        })}
        {games.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No games this week</li>}
      </ul>

      {status && <p className="mt-4 text-sm text-brand-text">{status}</p>}
    </div>
  );
}
