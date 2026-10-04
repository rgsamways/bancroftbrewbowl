import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";
import { FocusBar } from "../components/AdminLayout";

type Candidate = { id: string; displayName: string; pickedTeams: string[]; isYou: boolean };
type Wipeout = {
  id: string;
  poolId: string;
  weekNumber: number;
  game: { homeTeam: string; awayTeam: string } | null;
  candidateEntries: Candidate[];
};
type PoolInfo = { id: string; name: string };

/** A result would knock out every player left in a survivor pool. Nothing has been applied; the
 * admin ticks who stays in and everyone unticked is eliminated. */
export function WipeoutDecision() {
  const { poolId = "", wipeoutId = "" } = useParams();
  const navigate = useNavigate();
  const { data: events, error } = useApi<Wipeout[]>(`/pools/${poolId}/wipeouts`);
  const { data: pool } = useApi<PoolInfo>(`/pools/${poolId}`);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (error && !events) {
    return (
      <>
        <FocusBar />
        <p className="mt-6 text-sm text-brand-muted">We couldn't load this decision. Check your connection and try again.</p>
      </>
    );
  }
  if (!events || !pool) return null;

  const event = events.find((e) => e.id === wipeoutId);
  if (!event) {
    return (
      <>
        <FocusBar />
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-brand-text">Nothing to decide</h1>
        <p className="mt-2 text-sm text-brand-muted">This decision has already been made, or it no longer exists.</p>
        <Link
          to="/admin"
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink"
        >
          Back to your steps
        </Link>
      </>
    );
  }

  const total = event.candidateEntries.length;
  const k = kept.size;
  const mine = event.candidateEntries.find((c) => c.isYou);

  function toggle(id: string) {
    setKept((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/pools/${poolId}/wipeouts/${wipeoutId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ surviving_entry_ids: [...kept] }),
      });
      navigate("/admin", { replace: true });
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was changed.`);
      setBusy(false);
    }
  }

  return (
    <>
      <FocusBar onBack={() => navigate("/admin")} />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-400">This week</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight text-brand-text">Everyone would be out</h1>
      <p className="mt-2 text-sm text-brand-muted">
        {pool.name} &middot; week {event.weekNumber}
        {event.game ? ` · ${teamNickname(event.game.awayTeam)} @ ${teamNickname(event.game.homeTeam)}` : ""}
      </p>
      <p className="mt-2 text-sm text-brand-muted">
        Nothing has been applied yet. This result would eliminate all {total} players still alive. Choose anyone who should stay in.
        Everyone you leave unticked is eliminated.
      </p>

      {mine && (
        <p className="mt-3 rounded-[12px] border border-brand-border bg-brand-surface p-3 text-sm text-brand-muted">
          You're one of these players. This decision is recorded in Activity and marked as your own entry.
        </p>
      )}

      <ul className="mt-4 overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {event.candidateEntries.map((c) => (
          <li key={c.id} className="border-b border-brand-border last:border-b-0">
            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                checked={kept.has(c.id)}
                onChange={() => toggle(c.id)}
                className="h-5 w-5 flex-none accent-brand-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-brand-text">
                  {c.displayName}
                  {c.isYou && (
                    <span className="ml-2 rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">You</span>
                  )}
                </span>
                <span className="block text-sm text-brand-muted">
                  {c.pickedTeams.length > 0 ? `Picked ${c.pickedTeams.map(teamNickname).join(" and ")}, lost` : "No pick"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-brand-muted">
        {k} of {total} will stay in. The other {total - k} {total - k === 1 ? "is" : "are"} eliminated in week {event.weekNumber}.
      </p>
      {message && (
        <p role="alert" className="mt-2 text-sm text-brand-danger">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void confirm()}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-50"
      >
        {k === 0 ? "Eliminate everyone" : `Keep ${k} ${k === 1 ? "player" : "players"} alive`}
      </button>
    </>
  );
}
