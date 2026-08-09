import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { NFL_TEAMS, type SurvivorRulesConfig } from "@bbb/shared";
import { api } from "../lib/api";

type Pool = { id: string; seasonYear: number; rules: SurvivorRulesConfig };
type Week = { weekNumber: number; pickDeadline: string; locked: boolean };
type Pick = { weekNumber: number; teamCode: string; result: string };

export function PickScreen() {
  const { poolId, entryId } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  function refreshPicks() {
    if (!entryId) return;
    api<Pick[]>(`/entries/${entryId}/picks`).then(setPicks);
  }

  useEffect(() => {
    if (!poolId || !entryId) return;
    api<Pool>(`/pools/${poolId}`).then((fetched) => {
      setPool(fetched);
      api<Week[]>(`/nfl/weeks?year=${fetched.seasonYear}`).then(setWeeks);
    });
    refreshPicks();
  }, [poolId, entryId]);

  const currentWeek = useMemo(
    () => weeks.filter((w) => !w.locked).sort((a, b) => a.weekNumber - b.weekNumber)[0],
    [weeks]
  );

  const limit =
    currentWeek && pool?.rules.double_pick_weeks.includes(currentWeek.weekNumber) ? 2 : 1;
  const currentWeekPicks = picks.filter((p) => p.weekNumber === currentWeek?.weekNumber);
  const otherWeekTeams = useMemo(
    () => new Set(picks.filter((p) => p.weekNumber !== currentWeek?.weekNumber).map((p) => p.teamCode)),
    [picks, currentWeek]
  );

  async function pickTeam(teamCode: string) {
    if (!currentWeek) return;
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

  if (!currentWeek) return <p className="p-6 text-brand-muted">No open week right now.</p>;

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
