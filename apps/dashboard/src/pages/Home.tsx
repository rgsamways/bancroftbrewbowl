import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CANNED_PROMOTION_LABELS, type PromotionKind } from "@bbb/shared";
import { useSession } from "../lib/auth-client";
import { api } from "../lib/api";

type Pool = { id: string; name: string; seasonYear: number; status: string };
type MyEntry = {
  id: string;
  poolId: string;
  displayName: string;
  status: "alive" | "eliminated";
  pool: Pool;
};
type Week = { weekNumber: number; pickDeadline: string; locked: boolean };
type Game = {
  id: string;
  weekNumber: number;
  homeTeam: string;
  awayTeam: string;
  result: "pending" | "home_win" | "away_win" | "tie";
};
type Promotion = { id: string; seasonYear: number; weekNumber: number; title: string; description: string };
type CannedPromotion = { id: string; kind: PromotionKind; enabled: boolean };
type EligibleEntry = { id: string; displayName: string; poolName: string };
type EligibleResponse = {
  kind: PromotionKind;
  weekNumber?: number | null;
  eligibleEntries?: EligibleEntry[];
  teamCode?: string | null;
  pickCount?: number;
};

export function Home() {
  const { data: session } = useSession();
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);

  function refresh() {
    api<MyEntry[]>("/me/entries").then(setMyEntries);
    api<Pool[]>("/pools").then(setPools);
  }

  useEffect(refresh, []);

  const joinedPoolIds = new Set(myEntries.map((e) => e.poolId));
  const availablePools = pools.filter((p) => !joinedPoolIds.has(p.id));

  return (
    <div className="mx-auto max-w-lg px-6 pb-6">
      <p className="mb-8 text-brand-muted">
        Welcome{session?.user.name ? `, ${session.user.name}` : ""}
      </p>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Your pools
        </h2>
        <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
          {myEntries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={
                  entry.status === "alive"
                    ? `/pool/${entry.poolId}/entry/${entry.id}/pick`
                    : `/pool/${entry.poolId}`
                }
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-surface-raised"
              >
                <span className="text-brand-text">{entry.pool.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    entry.status === "alive"
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-brand-surface-raised text-brand-muted"
                  }`}
                >
                  {entry.status}
                </span>
              </Link>
            </li>
          ))}
          {myEntries.length === 0 && (
            <li className="px-3 py-2 text-sm text-brand-muted">You haven't joined a pool yet</li>
          )}
        </ul>
      </section>

      {availablePools.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Join a pool
          </h2>
          <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
            {availablePools.map((pool) => (
              <JoinPoolRow key={pool.id} pool={pool} onJoined={refresh} />
            ))}
          </ul>
        </section>
      )}

      <CurrentWeekSection />
    </div>
  );
}

// "Current week" = the most recent season with games imported, its first
// week that hasn't locked yet, or the most recent past week if the season
// is over — there's no stored "current season" setting (see NFL routes).
function CurrentWeekSection() {
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then((fetched) => {
      if (fetched.length > 0) setSeasonYear(Math.max(...fetched));
    });
  }, []);

  useEffect(() => {
    if (seasonYear === null) return;
    api<Week[]>(`/nfl/weeks?year=${seasonYear}`).then((weeks) => {
      if (weeks.length === 0) return;
      const firstUnlocked = weeks.find((w) => !w.locked);
      setCurrentWeek(firstUnlocked ? firstUnlocked.weekNumber : weeks[weeks.length - 1].weekNumber);
    });
  }, [seasonYear]);

  useEffect(() => {
    if (seasonYear === null || currentWeek === null) return;
    api<Game[]>(`/nfl/games?year=${seasonYear}&week=${currentWeek}`).then(setGames);
    api<Promotion[]>(`/promotions?year=${seasonYear}&week=${currentWeek}`).then(setPromotions);
  }, [seasonYear, currentWeek]);

  if (seasonYear === null || currentWeek === null) return null;

  return (
    <>
      <section className="mb-8">
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Week {currentWeek} games
        </h2>
        <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
          {games.map((g) => (
            <li key={g.id} className="flex items-center justify-between px-3 py-2 text-sm text-brand-text">
              <span>
                {g.awayTeam} @ {g.homeTeam}
              </span>
              <span className="rounded bg-brand-surface-raised px-2 py-0.5 text-xs text-brand-muted">
                {g.result === "pending" ? "pending" : g.result}
              </span>
            </li>
          ))}
          {games.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">No games this week</li>}
        </ul>
      </section>

      {promotions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
            This week's promotions
          </h2>
          <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
            {promotions.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <p className="font-semibold text-brand-text">{p.title}</p>
                <p className="text-brand-muted">{p.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CannedPromotionsSection seasonYear={seasonYear} />
    </>
  );
}

function CannedPromotionsSection({ seasonYear }: { seasonYear: number }) {
  const [enabledKinds, setEnabledKinds] = useState<PromotionKind[]>([]);
  const [eligible, setEligible] = useState<Record<string, EligibleResponse>>({});

  useEffect(() => {
    api<CannedPromotion[]>("/canned-promotions").then((fetched) => {
      setEnabledKinds(fetched.filter((p) => p.enabled).map((p) => p.kind));
    });
  }, []);

  useEffect(() => {
    enabledKinds.forEach((kind) => {
      api<EligibleResponse>(`/canned-promotions/${kind}/eligible?year=${seasonYear}`).then((result) => {
        setEligible((current) => ({ ...current, [kind]: result }));
      });
    });
  }, [enabledKinds, seasonYear]);

  const blurbs = enabledKinds
    .map((kind) => ({ kind, result: eligible[kind] }))
    .filter(({ result }) => result)
    .map(({ kind, result }) => describeCannedPromotion(kind, result!))
    .filter((blurb): blurb is string => blurb !== null);

  if (blurbs.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Active promotions
      </h2>
      <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {enabledKinds.map((kind) => {
          const result = eligible[kind];
          if (!result) return null;
          const blurb = describeCannedPromotion(kind, result);
          if (!blurb) return null;
          return (
            <li key={kind} className="px-3 py-2 text-sm">
              <p className="font-semibold text-brand-text">{CANNED_PROMOTION_LABELS[kind]}</p>
              <p className="text-brand-muted">{blurb}</p>
              {result.eligibleEntries && result.eligibleEntries.length > 0 && (
                <p className="mt-1 text-xs text-brand-muted">
                  {result.eligibleEntries.map((e) => `${e.displayName} (${e.poolName})`).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function describeCannedPromotion(kind: PromotionKind, result: EligibleResponse): string | null {
  if (kind === "survivor_sunday") {
    if (!result.eligibleEntries || result.eligibleEntries.length === 0) return null;
    return `${result.eligibleEntries.length} entries still alive are eligible — check in at the bar.`;
  }
  if (kind === "elimination_consolation") {
    if (!result.eligibleEntries || result.eligibleEntries.length === 0) return null;
    return `Eliminated in week ${result.weekNumber} — show this to redeem a consolation offer.`;
  }
  if (kind === "milestone_reward") {
    if (!result.eligibleEntries || result.eligibleEntries.length === 0) return null;
    return `Survived to week ${result.weekNumber} — you've unlocked a reward!`;
  }
  if (kind === "hot_team_special") {
    if (!result.teamCode) return null;
    return `${result.teamCode} is this week's hot pick (${result.pickCount} entries) — themed special is on.`;
  }
  return null;
}

function JoinPoolRow({ pool, onJoined }: { pool: Pool; onJoined: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join() {
    setError(null);
    setJoining(true);
    try {
      await api(`/pools/${pool.id}/join`, { method: "POST" });
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
      setJoining(false);
    }
  }

  return (
    <li className="flex items-center justify-between px-3 py-2">
      <span className="text-sm text-brand-text">
        {pool.name} <span className="text-brand-muted">({pool.seasonYear})</span>
      </span>
      <span className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={join}
          disabled={joining}
          className="rounded bg-brand-accent px-3 py-1 text-sm font-semibold text-white hover:bg-brand-accent-hover disabled:opacity-40"
        >
          Join
        </button>
      </span>
    </li>
  );
}
