import { useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../../lib/api";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";

type Found = { id: string; name: string; email: string; hasPassword: boolean };

/** For someone who is locked out: sign them out everywhere and remove their password, so they sign in
 * with an emailed link. Nothing is shown or created that could be read out as a password. */
export function OperatorSignInHelp() {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    setFound(null);
    try {
      setFound(await api<Found>(`/operator/users?email=${encodeURIComponent(email.trim())}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/operator/players/${found.id}/sign-in-reset`, { method: "POST" });
      setDone(`${found.name} is signed out everywhere and their password is removed. They can sign in with an emailed link.`);
      setFound(null);
      setEmail("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Help someone sign in</h1>
        <p className="mt-1 text-sm text-brand-muted">
          For a player who can't get in. This signs them out everywhere and removes their password, so they sign in with a link emailed to them.
        </p>
      </div>

      <form onSubmit={find} className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <label className="block text-sm font-semibold text-brand-text">
          Their email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
            className={`${inputClass} mt-1`}
          />
        </label>
        <button type="submit" disabled={busy || email.trim() === ""} className={secondaryButtonClass}>
          Find them
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-emerald-400">
          {done}
        </p>
      )}

      {found && (
        <section className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <p className="font-semibold text-brand-text">{found.name}</p>
          <p className="text-sm text-brand-muted">
            {found.email} &middot; {found.hasPassword ? "has a password" : "signs in with a link"}
          </p>
          <p className="mt-3 text-sm text-brand-text">
            This signs {found.name} out everywhere and removes their password. They'll sign in with an emailed link.
          </p>
          <button type="button" onClick={() => void reset()} disabled={busy} className={`${buttonClass} mt-3`}>
            Sign them out and remove password
          </button>
        </section>
      )}

      <Link to="/admin/more" className={secondaryButtonClass}>
        Back to More
      </Link>
    </div>
  );
}
