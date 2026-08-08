import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { WeekPills, WeekStatus, type Week } from "../components/WeekWidgets";

type Game = {
  id: string;
  weekNumber: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  result: "pending" | "home_win" | "away_win" | "tie";
  homeScore: number | null;
  awayScore: number | null;
};

export function SchedulePage() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then((fetched) => {
      const list = fetched.length > 0 ? fetched : [new Date().getFullYear()];
      setSeasons(list);
      setSeasonYear((current) => current ?? Math.max(...list));
    });
  }, []);

  useEffect(() => {
    if (seasonYear === null) return;
    api<Week[]>(`/nfl/weeks?year=${seasonYear}`).then((fetched) => {
      setWeeks(fetched);
      setSelectedWeek((current) => current ?? fetched[0]?.weekNumber ?? null);
    });
  }, [seasonYear]);

  function refreshGames() {
    if (seasonYear === null || selectedWeek === null) return;
    api<Game[]>(`/nfl/games?year=${seasonYear}&week=${selectedWeek}`).then(setGames);
  }

  useEffect(refreshGames, [seasonYear, selectedWeek]);

  async function enterResult(gameId: string, result: "home_win" | "away_win" | "tie") {
    await api(`/nfl/games/${gameId}/result`, { method: "POST", body: JSON.stringify({ result }) });
    refreshGames();
  }

  async function updateScore(gameId: string, field: "home_score" | "away_score", value: number) {
    await api(`/nfl/games/${gameId}/score`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
    refreshGames();
  }

  const activeWeek = weeks.find((w) => w.weekNumber === selectedWeek);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 pb-6">
      <label className="flex w-28 flex-col gap-1 text-sm text-brand-muted">
        Season
        <select
          value={seasonYear ?? ""}
          onChange={(event) => setSeasonYear(Number(event.target.value))}
          className="rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
        >
          {seasons.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      {weeks.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No games imported for {seasonYear} yet — run the schedule importer for this season.
        </p>
      ) : (
        <div>
          <WeekPills weeks={weeks} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
          {activeWeek && <WeekStatus week={activeWeek} />}

          <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
            {games.map((g) => (
              <GameRow key={g.id} game={g} onEnterResult={enterResult} onUpdateScore={updateScore} />
            ))}
            {games.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No games this week</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function GameRow({
  game,
  onEnterResult,
  onUpdateScore,
}: {
  game: Game;
  onEnterResult: (gameId: string, result: "home_win" | "away_win" | "tie") => void;
  onUpdateScore: (gameId: string, field: "home_score" | "away_score", value: number) => void;
}) {
  const [awayScore, setAwayScore] = useState(game.awayScore?.toString() ?? "");
  const [homeScore, setHomeScore] = useState(game.homeScore?.toString() ?? "");

  useEffect(() => {
    setAwayScore(game.awayScore?.toString() ?? "");
  }, [game.awayScore]);

  useEffect(() => {
    setHomeScore(game.homeScore?.toString() ?? "");
  }, [game.homeScore]);

  function buttonClass(active: boolean) {
    return `rounded border px-2 py-0.5 ${
      active ? "border-brand-accent bg-brand-accent text-white" : "border-brand-border hover:border-brand-accent"
    }`;
  }

  const awayLabel = game.result === "home_win" ? `${game.awayTeam} lost` : `${game.awayTeam} won`;
  const homeLabel = game.result === "away_win" ? `${game.homeTeam} lost` : `${game.homeTeam} won`;

  return (
    <li className="flex items-center justify-between px-3 py-2 text-sm text-brand-text">
      <span>
        {game.awayTeam} @ {game.homeTeam}
      </span>
      <span className="flex items-center gap-1">
        <button onClick={() => onEnterResult(game.id, "away_win")} className={buttonClass(game.result === "away_win")}>
          {awayLabel}
        </button>
        <input
          type="number"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          onBlur={() => {
            if (awayScore !== "" && Number(awayScore) !== game.awayScore) {
              onUpdateScore(game.id, "away_score", Number(awayScore));
            }
          }}
          className="w-14 rounded border border-brand-border bg-brand-bg px-1 py-0.5 text-center text-brand-text focus:border-brand-accent focus:outline-none"
        />
        <button onClick={() => onEnterResult(game.id, "tie")} className={buttonClass(game.result === "tie")}>
          Tie
        </button>
        <input
          type="number"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          onBlur={() => {
            if (homeScore !== "" && Number(homeScore) !== game.homeScore) {
              onUpdateScore(game.id, "home_score", Number(homeScore));
            }
          }}
          className="w-14 rounded border border-brand-border bg-brand-bg px-1 py-0.5 text-center text-brand-text focus:border-brand-accent focus:outline-none"
        />
        <button onClick={() => onEnterResult(game.id, "home_win")} className={buttonClass(game.result === "home_win")}>
          {homeLabel}
        </button>
      </span>
    </li>
  );
}
