import { useState } from "react";
import { Link } from "react-router";
import { initials, type AdminSummary } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass, type PoolRow, type RosterEntry } from "./shared";

const SHORT = 8;

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "accent" | "out" }) {
  const cls =
    tone === "accent"
      ? "bg-brand-accent-soft text-brand-accent"
      : tone === "out"
        ? "bg-brand-surface-raised text-brand-muted"
        : "bg-emerald-950 text-emerald-400";
  return <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function StatusEditor({
  entry,
  poolId,
  onDone,
}: {
  entry: RosterEntry;
  poolId: string;
  onDone: (changed: boolean) => void;
}) {
  const [out, setOut] = useState(entry.status === "eliminated");
  const [week, setWeek] = useState(entry.eliminatedWeek ? String(entry.eliminatedWeek) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const weekNumber = Number(week);
    if (out && (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 25)) {
      setError("Enter the week they went out, a whole number from 1 to 25.");
      return;
    }
    setBusy(true);
    try {
      await api(`/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(out ? { status: "eliminated", eliminatedWeek: weekNumber } : { status: "alive" }),
      });
      onDone(true);
    } catch (e) {
      setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was changed.`);
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-brand-border bg-brand-surface-raised px-4 py-3" data-poolid={poolId}>
      <p className="text-sm text-brand-muted">
        Use this to fix a mistake, for example after correcting a result. It changes the standings straight away.
      </p>
      {entry.isYou && (
        <p className="mt-2 rounded-[12px] border border-brand-border p-3 text-sm text-brand-muted">
          This is your own entry. The change is recorded in Activity and marked as your own entry.
        </p>
      )}
      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-semibold text-brand-text">Status</legend>
        <div className="flex gap-2">
          {[
            { label: "Alive", value: false },
            { label: "Out", value: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={out === o.value}
              onClick={() => setOut(o.value)}
              className={`min-h-11 flex-1 rounded-[12px] border text-sm font-semibold ${
                out === o.value ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      {out && (
        <label className="mt-3 block text-sm font-semibold text-brand-text">
          Out in week
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={25}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className={buttonClass}>
          Save
        </button>
        <button type="button" disabled={busy} onClick={() => onDone(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddPlayer({ pool, onDone }: { pool: PoolRow; onDone: (added: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/pools/${pool.id}/entries`, {
        method: "POST",
        body: JSON.stringify(needsName ? { email: email.trim(), display_name: name.trim() } : { email: email.trim() }),
      });
      onDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // No account for this email yet: ask for a name, then try again.
        setNeedsName(true);
        setError(null);
      } else {
        setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nobody was added.`);
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
      <h2 className="font-semibold text-brand-text">Add a player</h2>
      <label className="block text-sm font-semibold text-brand-text">
        Their email address
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setNeedsName(false);
          }}
          placeholder="name@example.com"
          className={`${inputClass} mt-1`}
        />
      </label>
      {needsName && (
        <label className="block text-sm font-semibold text-brand-text">
          Their name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-brand-muted">
            They don't have an account yet. They'll be in the pool the first time they sign in with this email.
          </span>
        </label>
      )}
      {!needsName && (
        <p className="text-xs text-brand-muted">
          If they don't have an account yet, they'll be in the pool the first time they sign in with this email.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonClass}>
        Add to {pool.name}
      </button>
      <button type="button" onClick={() => onDone(false)} className={secondaryButtonClass}>
        Cancel
      </button>
    </form>
  );
}

export function PlayersTab({ pool, summary }: { pool: PoolRow; summary: AdminSummary | null }) {
  const { data: roster, reload } = useApi<RosterEntry[]>(`/pools/${pool.id}/entries`);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!roster) return null;

  const survivor = pool.type === "survivor";
  const alive = roster.filter((e) => e.status === "alive").length;
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? roster.filter((e) => e.displayName.toLowerCase().includes(needle) || e.email.toLowerCase().includes(needle))
    : roster;
  const visible = needle || showAll ? matches : matches.slice(0, SHORT);
  const wipeout = summary?.wipeouts.find((w) => w.poolId === pool.id);

  return (
    <div className="space-y-4">
      {wipeout && (
        <Link
          to={`/admin/wipeout/${wipeout.poolId}/${wipeout.wipeoutId}`}
          className="block rounded-[14px] border border-amber-500/50 bg-brand-surface p-4 text-sm text-brand-text"
        >
          <span className="font-semibold text-amber-400">A decision is waiting.</span> A result would knock out every player left.
          Tap to decide.
        </Link>
      )}

      {adding ? (
        <AddPlayer
          pool={pool}
          onDone={(added) => {
            setAdding(false);
            if (added) {
              setNotice("Player added.");
              void reload();
            }
          }}
        />
      ) : (
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm font-semibold text-brand-muted">
            Find a player
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name or email"
              autoComplete="off"
              className={`${inputClass} mt-1`}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setAdding(true);
            }}
            className="min-h-11 flex-none rounded-[12px] bg-brand-accent px-5 font-semibold text-brand-accent-ink"
          >
            Add
          </button>
        </div>
      )}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      <p className="text-sm text-brand-muted">
        {roster.length} {roster.length === 1 ? "player" : "players"}
        {survivor ? `, ${alive} alive` : ""}
      </p>

      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {visible.map((entry) => {
          const open = editing === entry.id;
          const canEdit = survivor;
          const row = (
            <>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 flex-none place-items-center rounded-full border border-brand-border bg-brand-surface-raised text-xs font-semibold text-brand-text"
              >
                {initials(entry.displayName)}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2">
                  <span className="truncate text-brand-text">{entry.displayName}</span>
                  {entry.isYou && <Chip tone="accent">You</Chip>}
                  {entry.invited && <Chip tone="out">Invited</Chip>}
                </span>
                <span className="block truncate text-sm text-brand-muted">{entry.email}</span>
              </span>
              {survivor ? (
                <Chip tone={entry.status === "alive" ? "plain" : "out"}>
                  {entry.status === "alive" ? "Alive" : `Out wk ${entry.eliminatedWeek ?? "?"}`}
                </Chip>
              ) : (
                <span className="flex-none text-sm text-brand-muted">{entry.points ?? 0} pts</span>
              )}
            </>
          );
          return (
            <li key={entry.id} className="border-b border-brand-border last:border-b-0">
              {canEdit ? (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setEditing(open ? null : entry.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised"
                >
                  {row}
                </button>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-4 py-2">{row}</div>
              )}
              {open && (
                <StatusEditor
                  entry={entry}
                  poolId={pool.id}
                  onDone={(changed) => {
                    setEditing(null);
                    if (changed) {
                      setNotice(`Saved. ${entry.displayName} is updated.`);
                      void reload();
                    }
                  }}
                />
              )}
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="px-4 py-3 text-sm text-brand-muted">{needle ? "No players match" : "Nobody has joined yet"}</li>
        )}
      </ul>
      {!needle && !showAll && matches.length > SHORT && (
        <button type="button" onClick={() => setShowAll(true)} className={secondaryButtonClass}>
          Show all {matches.length}
        </button>
      )}
    </div>
  );
}
