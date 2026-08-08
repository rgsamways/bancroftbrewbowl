import { useEffect, useState } from "react";
import { authClient, useSession } from "../lib/auth-client";

export function Account() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sendingEmailChange, setSendingEmailChange] = useState(false);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session?.user.name]);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setSavingName(true);
    setNameStatus(null);
    try {
      await authClient.updateUser({ name });
      setNameStatus("Saved.");
    } catch (e) {
      setNameStatus(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingName(false);
    }
  }

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    setSendingEmailChange(true);
    setEmailStatus(null);
    try {
      const { error } = await authClient.changeEmail({
        newEmail,
        callbackURL: `${window.location.origin}/account`,
      });
      if (error) {
        setEmailStatus(error.message ?? "Failed to change email");
      } else {
        setEmailStatus(`Check ${newEmail} for a confirmation link.`);
        setNewEmail("");
      }
    } catch (e) {
      setEmailStatus(e instanceof Error ? e.message : "Failed to change email");
    } finally {
      setSendingEmailChange(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-6 pb-6">
      <form onSubmit={saveName} className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Display name
        </h2>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
        <p className="text-sm text-brand-muted">This is the name used whenever you join a pool.</p>
        <button
          type="submit"
          disabled={savingName}
          className="self-start rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover disabled:opacity-40"
        >
          Save
        </button>
        {nameStatus && <p className="text-sm text-brand-text">{nameStatus}</p>}
      </form>

      <form onSubmit={changeEmail} className="flex flex-col gap-3 border-t border-brand-border pt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">Email</h2>
        <p className="text-sm text-brand-muted">
          Current: <span className="text-brand-text">{session?.user.email}</span>
        </p>
        <input
          type="email"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          placeholder="New email address"
          required
          className="rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
        <p className="text-sm text-brand-muted">
          We'll send a confirmation link to the new address — nothing changes until you click it.
        </p>
        <button
          type="submit"
          disabled={sendingEmailChange}
          className="self-start rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover disabled:opacity-40"
        >
          Send confirmation link
        </button>
        {emailStatus && <p className="text-sm text-brand-text">{emailStatus}</p>}
      </form>
    </div>
  );
}
