import { useState } from "react";
import { Link } from "react-router";
import { MAX_ACTIVE_NOTICES, type Notice } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "./admin-pool/shared";

const label = "block text-sm font-semibold text-brand-text";

/** Notices: an important message at the top of every player page. Post one, or remove one. */
export function AdminNotices() {
  const { data, error, reload } = useApi<{ notices: Notice[] }>("/notices");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [showThrough, setShowThrough] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const notices = data?.notices ?? [];
  const full = notices.length >= MAX_ACTIVE_NOTICES;

  async function post(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    setPosted(false);
    try {
      await api("/notices", { method: "POST", body: JSON.stringify({ title, message, showThrough: showThrough || null }) });
      setTitle("");
      setMessage("");
      setShowThrough("");
      setPosted(true);
      await reload();
    } catch (e) {
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was posted.`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setProblem(null);
    try {
      await api(`/notices/${id}`, { method: "DELETE" });
      setConfirming(null);
      await reload();
    } catch (e) {
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was removed.`);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/more" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          More
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Notices</h1>
        <p className="mt-1 text-sm text-brand-muted">
          A notice shows at the top of every page players see. Use it for big events or important changes. Each player can close it. A notice can't be edited: remove it and post a new one.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-muted">Showing now</h2>
        {error && !data && <p className="text-sm text-brand-muted">We couldn't load this. Check your connection and try again.</p>}
        {data && notices.length === 0 && (
          <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">No notices are showing.</p>
        )}
        {notices.length > 0 && (
          <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            {notices.map((n) => (
              <li key={n.id} data-testid="admin-notice" className="border-b border-brand-border px-4 py-3 last:border-b-0">
                <p className="text-brand-text">{n.title}</p>
                <p className="text-sm text-brand-muted">{n.message}</p>
                <p className="mt-1 text-xs text-brand-faint">{n.showThrough ? `Shows through ${n.showThrough}` : "Shows until you remove it"}</p>
                {confirming === n.id ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void remove(n.id)}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-brand-danger px-4 font-semibold text-brand-accent-ink"
                    >
                      Yes, remove it
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={secondaryButtonClass}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(n.id)}
                    aria-label={`Remove ${n.title}`}
                    className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={post} className="space-y-4">
        <h2 className="text-sm font-semibold text-brand-muted">Post a notice</h2>
        {full && <p className="text-sm text-brand-muted">{MAX_ACTIVE_NOTICES} notices are showing. Remove one before you post another.</p>}
        <label className={label}>
          Title
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-1`} placeholder="Live music this Saturday" />
        </label>
        <label className={label}>
          Message
          <textarea value={message} rows={3} maxLength={200} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} mt-1 py-2`} placeholder="Doors at 7. Kitchen open late." />
        </label>
        <label className={label}>
          Show through (optional)
          <input type="date" value={showThrough} onChange={(e) => setShowThrough(e.target.value)} className={`${inputClass} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-brand-muted">Leave empty to show it until you remove it.</span>
        </label>
        {problem && (
          <p role="alert" className="text-sm text-brand-danger">
            {problem}
          </p>
        )}
        {posted && (
          <p role="status" className="text-sm text-brand-success">
            Posted. Players see it the next time they open a page.
          </p>
        )}
        <button type="submit" disabled={busy || full || title.trim() === "" || message.trim() === ""} className={`${buttonClass} disabled:opacity-50`}>
          Post notice
        </button>
      </form>
    </div>
  );
}
