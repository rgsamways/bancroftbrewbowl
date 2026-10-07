import { useState } from "react";
import { Link } from "react-router";
import type { AdminTv } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";

const dangerClass = "flex min-h-12 flex-none items-center justify-center whitespace-nowrap rounded-[12px] bg-brand-danger px-4 font-semibold text-brand-accent-ink disabled:opacity-50";

/** Site setup for TVs: add a screen, copy its private link, rename it, reset the link or delete it.
 * Only the site owner sees this; anyone with the link can watch that TV, so keep it private. */
export function OperatorTv() {
  const { data, error, reload } = useApi<AdminTv>("/tv");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; what: "reset" | "delete" } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  async function run(work: () => Promise<void>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage({ tone: "ok", text: ok });
      setConfirming(null);
      setRenaming(null);
      await reload();
    } catch (e) {
      setConfirming(null);
      setMessage({ tone: "bad", text: `${e instanceof ApiError ? e.message : "Something went wrong"} Nothing was changed.` });
    } finally {
      setBusy(false);
    }
  }

  const linkOf = (code: string) => `${window.location.origin}/tv/${code}`;

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(linkOf(code));
      setMessage({ tone: "ok", text: "Link copied." });
    } catch {
      setMessage({ tone: "bad", text: "Couldn't copy. Press and hold the link to copy it." });
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">TV screens</h1>
        <p className="mt-1 text-sm text-brand-muted">
          One screen per TV. Open its link on the TV and it plays whatever playlist it is set to. Anyone with a link can watch that TV, so don't share it. Choose what each one plays under{" "}
          <Link to="/admin/tv" className="font-semibold text-brand-accent underline">
            More, then TV screens
          </Link>
          .
        </p>
      </div>

      {error && !data && <p className="text-sm text-brand-danger">We couldn't load the screens.</p>}
      {data && data.screens.length === 0 && <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">No screens yet.</p>}
      {data && data.screens.length > 0 && (
        <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
          {data.screens.map((s) => (
            <li key={s.id} data-testid="setup-screen" className="space-y-2 border-b border-brand-border px-4 py-3 last:border-b-0">
              {renaming?.id === s.id ? (
                <div className="flex gap-2">
                  <input value={renaming.name} maxLength={60} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} aria-label="Screen name" className={inputClass} />
                  <button
                    type="button"
                    disabled={busy || renaming.name.trim() === ""}
                    onClick={() => void run(() => api(`/tv/screens/${s.id}`, { method: "PATCH", body: JSON.stringify({ name: renaming.name }) }), "Renamed.")}
                    className={`${buttonClass} !w-auto flex-none`}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="flex items-center justify-between text-brand-text">
                  {s.name}
                  <button type="button" onClick={() => setRenaming({ id: s.id, name: s.name })} aria-label={`Rename ${s.name}`} className="min-h-11 px-2 text-sm font-semibold text-brand-muted underline">
                    Rename
                  </button>
                </p>
              )}
              <input readOnly value={s.code ? linkOf(s.code) : ""} aria-label={`Link for ${s.name}`} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} text-sm`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy(s.code ?? "")} className={`${secondaryButtonClass} !w-auto`}>
                  Copy link
                </button>
                {confirming?.id === s.id && confirming.what === "reset" ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => void run(() => api(`/tv/screens/${s.id}/reset-link`, { method: "POST" }), "The link was reset. Open the new link on the TV.")} className={dangerClass}>
                      Yes, reset it
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={`${secondaryButtonClass} !w-auto`}>
                      Keep it
                    </button>
                  </>
                ) : confirming?.id === s.id && confirming.what === "delete" ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => void run(() => api(`/tv/screens/${s.id}`, { method: "DELETE" }), "The screen was deleted.")} className={dangerClass}>
                      Yes, delete it
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={`${secondaryButtonClass} !w-auto`}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setConfirming({ id: s.id, what: "reset" })} aria-label={`Reset link for ${s.name}`} className={`${secondaryButtonClass} !w-auto`}>
                      Reset link
                    </button>
                    <button type="button" onClick={() => setConfirming({ id: s.id, what: "delete" })} aria-label={`Delete ${s.name}`} className={`${secondaryButtonClass} !w-auto`}>
                      Delete
                    </button>
                  </>
                )}
              </div>
              {confirming?.id === s.id && confirming.what === "reset" && <p className="text-xs text-brand-muted">The old link stops working at once. The screen keeps its playlist and settings.</p>}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("/tv/screens", { method: "POST", body: JSON.stringify({ name }) });
            setName("");
          }, "Screen added. Copy its link onto the TV.");
        }}
        className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4"
      >
        <label className="block text-sm font-semibold text-brand-text">
          Add a screen
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Bar TV" className={`${inputClass} mt-1`} />
        </label>
        <button type="submit" disabled={busy || name.trim() === ""} className={`${buttonClass} disabled:opacity-50`}>
          Add screen
        </button>
      </form>

      {message && (
        <p role={message.tone === "bad" ? "alert" : "status"} className={`text-sm ${message.tone === "bad" ? "text-brand-danger" : "text-emerald-400"}`}>
          {message.text}
        </p>
      )}

      <Link to="/admin/more" className={secondaryButtonClass}>
        Back to More
      </Link>
    </div>
  );
}
