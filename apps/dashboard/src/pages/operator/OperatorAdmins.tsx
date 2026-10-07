import { useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";

type AdminRow = { id: string; name: string; email: string; isOperator: boolean };

/** Who has admin access: add someone who has signed in once, or remove an admin. The last admin and
 * the site owner's own account can't be removed. */
export function OperatorAdmins() {
  const { data: admins, error: loadError, reload } = useApi<AdminRow[]>("/operator/admins");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<AdminRow & { alreadyAdmin?: boolean }>("/operator/admins", { method: "POST", body: JSON.stringify({ email }) });
      setMessage({ tone: "ok", text: res.alreadyAdmin ? `${res.name} is already an admin.` : `${res.name} is now an admin.` });
      setEmail("");
      await reload();
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof ApiError ? e.message : "Something went wrong. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminRow) {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/operator/admins/${row.id}`, { method: "DELETE" });
      setMessage({ tone: "ok", text: `${row.name} is no longer an admin.` });
      setConfirming(null);
      await reload();
    } catch (e) {
      setConfirming(null);
      setMessage({ tone: "bad", text: e instanceof ApiError ? e.message : "Something went wrong. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Admins</h1>
        <p className="mt-1 text-sm text-brand-muted">Admins run the weekly job. Each change is recorded in Activity.</p>
      </div>

      {loadError && !admins && <p className="text-sm text-brand-danger">We couldn't load the admins.</p>}
      {admins && (
        <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
          {admins.map((a) => (
            <li key={a.id} className="border-b border-brand-border px-4 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-brand-text">
                    {a.name}
                    {a.isOperator && <span className="ml-2 rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">Site owner</span>}
                  </span>
                  <span className="block truncate text-sm text-brand-muted">{a.email}</span>
                </span>
                {!a.isOperator && confirming !== a.id && (
                  <button type="button" onClick={() => setConfirming(a.id)} className="min-h-11 text-sm font-semibold text-brand-danger">
                    Remove
                  </button>
                )}
              </div>
              {confirming === a.id && (
                <div className="mt-2 rounded-[12px] bg-brand-surface-raised p-3 text-sm">
                  <p className="text-brand-text">Remove {a.name}'s admin access? They can still play.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void remove(a)} className={buttonClass}>
                      Remove admin
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={secondaryButtonClass}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <label className="block text-sm font-semibold text-brand-text">
          Add an admin by email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
            className={`${inputClass} mt-1`}
          />
        </label>
        <p className="text-xs text-brand-muted">They need to have signed in once first.</p>
        <button type="submit" disabled={busy || email.trim() === ""} className={buttonClass}>
          Make them an admin
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
