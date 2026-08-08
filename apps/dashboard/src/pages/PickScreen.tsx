import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { NFL_TEAMS } from "@bbb/shared";
import { api } from "../lib/api";

type Pool = { id: string; seasonYear: number };
type Week = { weekNumber: number; pickDeadline: string; locked: boolean };
type Pick = { weekNumber: number; teamCode: string; result: string };

export function PickScreen() {
  const { poolId, entryId } = useParams();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId || !entryId) return;
    api<Pool>(`/pools/${poolId}`).then((pool) => {
      api<Week[]>(`/nfl/weeks?year=${pool.seasonYear}`).then(setWeeks);
    });
    api<Pick[]>(`/entries/${entryId}/picks`).then(setPicks);
  }, [poolId, entryId]);

  const currentWeek = useMemo(
    () => weeks.filter((w) => !w.locked).sort((a, b) => a.weekNumber - b.weekNumber)[0],
    [weeks]
  );

  const usedTeams = useMemo(() => new Set(picks.map((p) => p.teamCode)), [picks]);
  const currentPick = picks.find((p) => p.weekNumber === currentWeek?.weekNumber);

  async function submitPick() {
    if (!currentWeek || !selectedTeam) return;
    setStatus(null);
    try {
      await api(`/entries/${entryId}/picks`, {
        method: "POST",
        body: JSON.stringify({ week_number: currentWeek.weekNumber, team_code: selectedTeam }),
      });
      setPicks((prev) => [
        ...prev.filter((p) => p.weekNumber !== currentWeek.weekNumber),
        { weekNumber: currentWeek.weekNumber, teamCode: selectedTeam, result: "pending" },
      ]);
      setStatus("Pick submitted.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to submit pick");
    }
  }

  if (!currentWeek) return <p className="p-6 text-brand-muted">No open week right now.</p>;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="font-display text-2xl font-bold text-brand-text">
        Week {currentWeek.weekNumber} pick
      </h1>
      {currentPick && (
        <p className="mt-2 text-sm text-brand-muted">
          Current pick: <span className="font-semibold text-brand-text">{currentPick.teamCode}</span>
        </p>
      )}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {NFL_TEAMS.map((team) => {
          const disabled = usedTeams.has(team.code) && currentPick?.teamCode !== team.code;
          return (
            <button
              key={team.code}
              disabled={disabled}
              onClick={() => setSelectedTeam(team.code)}
              className={`rounded border px-2 py-2 text-sm font-medium ${
                selectedTeam === team.code
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

      <button
        onClick={submitPick}
        disabled={!selectedTeam}
        className="mt-4 rounded bg-brand-accent px-4 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover disabled:opacity-40"
      >
        Submit pick
      </button>
      {status && <p className="mt-2 text-sm text-brand-text">{status}</p>}
    </div>
  );
}
