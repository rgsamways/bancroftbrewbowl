import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { DECLINE_REASON_MAX, type AdminRequestDetail } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";
import { FocusBar } from "../components/AdminLayout";
import { buttonClass, inputClass, secondaryButtonClass } from "./admin-pool/shared";

// The screens for the "another admin confirms" rule: look at a decision, confirm it or decline
// it, and the end screens that say plainly what happened.

const nameList = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const heading = "mt-1 text-3xl font-semibold leading-tight text-brand-text";

function Gone() {
  return (
    <>
      <FocusBar />
      <h1 className={`${heading} mt-6`}>Nothing to confirm</h1>
      <p className="mt-2 text-sm text-brand-muted">This request has been dealt with, or it no longer exists.</p>
      <Link to="/admin" className={`${buttonClass} mt-6`}>
        Back to your steps
      </Link>
    </>
  );
}

function statusText(d: AdminRequestDetail) {
  const to = d.change!.to;
  return to.status === "alive" ? "Alive" : `Out in week ${to.eliminatedWeek}`;
}

/** What was chosen, so the second admin can judge it. */
export function ConfirmRequest() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: d, error } = useApi<AdminRequestDetail>(`/admin/requests/${id}`);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (error && !d) {
    return error.status === 404 ? (
      <Gone />
    ) : (
      <>
        <FocusBar />
        <p className="mt-6 text-sm text-brand-muted">We couldn't load this decision. Check your connection and try again.</p>
      </>
    );
  }
  if (!d) return null;
  if (!d.canDecide) {
    return (
      <>
        <FocusBar />
        <h1 className={`${heading} mt-6`}>{d.isRequester && d.status === "pending" ? "Waiting for confirmation" : "Nothing to confirm"}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {d.isRequester && d.status === "pending"
            ? `${nameList(d.askedAdmins)} can confirm this. It can't be you, and nothing changes until they do.`
            : "This request has been dealt with."}
        </p>
        <Link to="/admin" className={`${buttonClass} mt-6`}>
          Back to your steps
        </Link>
      </>
    );
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/admin/requests/${id}/confirm`, { method: "POST" });
      navigate(`/admin/requests/${id}/done/confirmed`, { replace: true });
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}`);
      setBusy(false);
    }
  }

  const isWipeout = d.kind === "wipeout_resolution";
  const matchup = d.game ? `${teamNickname(d.game.awayTeam)} @ ${teamNickname(d.game.homeTeam)}` : null;
  const keptCount = d.players.filter((p) => p.kept).length;

  return (
    <>
      <FocusBar onBack={() => navigate("/admin")} />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-400">Needs your confirmation</p>
      <h1 className={heading}>Confirm a decision</h1>
      <p className="mt-2 text-sm text-brand-muted">
        {d.poolName}
        {isWipeout && d.weekNumber ? ` · week ${d.weekNumber}` : ""}
        {matchup ? ` · ${matchup}` : ""}
      </p>
      <p className="mt-2 text-sm text-brand-muted">
        {isWipeout
          ? `${d.requestedByName} is one of the players. They chose who stays alive, and kept themselves. That's why a second admin has to confirm it.`
          : `${d.requestedByName} wants to change their own status. That's why a second admin has to confirm it.`}
      </p>

      <h2 className="mb-2 mt-5 text-sm font-semibold text-brand-muted">What they chose</h2>
      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {isWipeout &&
          d.players.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-brand-border px-4 py-2 last:border-b-0">
              <span className="min-w-0">
                <span className="block text-brand-text">
                  {p.displayName}
                  {p.isRequesterEntry && (
                    <span className="ml-2 rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">Their own entry</span>
                  )}
                </span>
                <span className="block text-sm text-brand-muted">
                  {p.pickedTeams.length > 0 ? `Picked ${p.pickedTeams.map(teamNickname).join(" and ")}` : "No pick"}
                </span>
              </span>
              <span className={`flex-none text-sm font-semibold ${p.kept ? "text-emerald-400" : "text-brand-muted"}`}>
                {p.kept ? "Kept alive" : "Eliminated"}
              </span>
            </li>
          ))}
        {d.change && (
          <li className="px-4 py-3">
            <span className="block text-brand-text">
              {d.change.displayName}
              {d.change.isRequesterEntry && (
                <span className="ml-2 rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">Their own entry</span>
              )}
            </span>
            <span className="block text-sm text-brand-muted">
              Now {d.change.from.status === "alive" ? "alive" : `out in week ${d.change.from.eliminatedWeek}`}. Would become{" "}
              <strong className="text-brand-text">{statusText(d)}</strong>.
            </span>
          </li>
        )}
      </ul>
      {isWipeout && (
        <p className="mt-3 text-sm text-brand-muted">
          Everyone would be out unless someone is kept. If you confirm, {keptCount} of {d.players.length} stay in and the rest are
          eliminated.
        </p>
      )}

      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}
      <div className="mt-5 space-y-2">
        <button type="button" disabled={busy} onClick={() => void confirm()} className={buttonClass}>
          Confirm
        </button>
        <Link to={`/admin/requests/${id}/decline`} className={secondaryButtonClass}>
          Don't confirm
        </Link>
      </div>
    </>
  );
}

const QUICK_REASONS = ["Let's talk about it first", "Check the result first", "I'd choose differently"];

export function DeclineRequest() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: d } = useApi<AdminRequestDetail>(`/admin/requests/${id}`);
  const [quick, setQuick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!d) return null;

  async function send() {
    const reason = [quick, note.trim()].filter(Boolean).join(": ").slice(0, DECLINE_REASON_MAX);
    setBusy(true);
    setMessage(null);
    try {
      await api(`/admin/requests/${id}/decline`, { method: "POST", body: JSON.stringify(reason ? { reason } : {}) });
      navigate(`/admin/requests/${id}/done/declined`, { replace: true });
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <>
      <FocusBar onBack={() => navigate(`/admin/requests/${id}`)} />
      <h1 className={`${heading} mt-2`}>Why not?</h1>
      <p className="mt-2 text-sm text-brand-muted">
        Optional. {d.requestedByName} will see this, and nothing changes in {d.poolName}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={quick === r}
            onClick={() => setQuick(quick === r ? null : r)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              quick === r ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold text-brand-text">
        Add a note (optional)
        <input
          value={note}
          maxLength={100}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Anything you want ${d.requestedByName} to know`}
          className={`${inputClass} mt-1`}
        />
      </label>
      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void send()} className={`${buttonClass} mt-5`}>
        Send
      </button>
    </>
  );
}

/** The end screens: sent, confirmed, not confirmed. Each says plainly what did and did not happen. */
export function RequestDone() {
  const { id = "", outcome = "" } = useParams();
  const { data: d } = useApi<AdminRequestDetail>(`/admin/requests/${id}`);
  if (!d) return null;

  const [title, text] =
    outcome === "sent"
      ? ["Sent for confirmation", `${nameList(d.askedAdmins)} ${d.askedAdmins.length === 1 ? "has" : "have"} been asked. Nothing changes in ${d.poolName} until ${d.askedAdmins.length === 1 ? "they confirm" : "one of them confirms"}.`]
      : outcome === "confirmed"
        ? [
            "Confirmed",
            `${d.poolName} has been updated. Both of you are recorded in Activity.`,
          ]
        : [
            "Not confirmed",
            `${d.requestedByName} will see that you didn't confirm${d.declineReason ? `, and your reason` : ""}. Nothing has changed in ${d.poolName}.`,
          ];
  return (
    <>
      <FocusBar />
      <h1 className={`${heading} mt-6`}>{title}</h1>
      <p className="mt-2 text-sm text-brand-muted">{text}</p>
      <Link to="/admin" className={`${buttonClass} mt-6`}>
        Back to your steps
      </Link>
    </>
  );
}
