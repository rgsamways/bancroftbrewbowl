import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import type { MeSummary, PoolType } from "@bbb/shared";
import { useSession } from "../lib/auth-client";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";

type Pool = { id: string; name: string; seasonYear: number; status: string; type: PoolType };

const RULES: Record<PoolType, [string, string][]> = {
  survivor: [
    ["One pick a week", "Choose a team you think will win."],
    ["Each team only once", "Once you've used a team, it's off the table for the rest of the season."],
    ["A loss or a tie puts you out", "Get it wrong and you're eliminated. Last one standing wins."],
    ["Picks lock at kickoff", "You can change your pick until the week's first game starts."],
  ],
  pick_em: [
    ["Pick every game", "Choose the winner of each game, every week."],
    ["A point for each right pick", "The most points at the end of the season wins."],
    ["You can't be knocked out", "Miss a pick and you just don't score that game. A tied game doesn't score."],
    ["Picks lock at kickoff", "You can change your picks until the week's first game starts."],
  ],
};

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-50";
const secondary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent";

export function JoinPage() {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: pool, error: poolError } = useApi<Pool>(`/pools/${poolId}`);
  const { data: summary } = useApi<MeSummary>("/me/summary");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (poolError) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-6">
        <h1 className="text-2xl font-semibold text-brand-text">We couldn't find that pool</h1>
        <Link to="/" className={`${secondary} mt-6`}>
          Back to Home
        </Link>
      </div>
    );
  }
  if (!pool || !summary) return null;

  // Already in: go to the entry instead of joining twice.
  const existing = summary.entries.find((e) => e.poolId === pool.id);
  if (existing) return <Navigate to={`/pool/${pool.id}/entry/${existing.entryId}/pick`} replace />;

  if (pool.status === "completed") {
    return (
      <div className="mx-auto max-w-lg px-6 pt-6">
        <h1 className="text-2xl font-semibold text-brand-text">{pool.name}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {pool.name} has finished, so it isn't taking new players.
        </p>
        <Link to={`/pool/${pool.id}`} className={`${primary} mt-6`}>
          See final standings
        </Link>
        <Link to="/" className={`${secondary} mt-3`}>
          Back to Home
        </Link>
      </div>
    );
  }

  async function join() {
    if (!pool) return;
    setError(null);
    setJoining(true);
    try {
      const entry = await api<{ id: string }>(`/pools/${pool.id}/join`, { method: "POST" });
      navigate(`/pool/${pool.id}/entry/${entry.id}/pick`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't add you. Please try again.");
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{pool.name}</h1>
      <p className="mt-1 text-sm text-brand-muted">
        {pool.type === "pick_em" ? "Pick 'em" : "Survivor"} &middot; {pool.seasonYear} season
      </p>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-brand-muted">How this pool works</h2>
      <ul className="space-y-3">
        {RULES[pool.type].map(([title, text]) => (
          <li key={title} className="text-sm text-brand-muted">
            <span className="block font-semibold text-brand-text">{title}</span>
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <div>
          <p className="text-xs text-brand-muted">You'll join as</p>
          <p className="font-semibold text-brand-text">{session?.user.name || session?.user.email}</p>
          <p className="text-xs text-brand-faint">Shown to other players</p>
        </div>
        <Link to="/account" className="min-h-11 content-center text-sm font-semibold text-brand-accent">
          Change
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-3">
        <button type="button" onClick={join} disabled={joining} className={primary}>
          Join {pool.name}
        </button>
        <Link to="/" className={secondary}>
          Not now
        </Link>
      </div>
      <p className="mt-8 text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}
