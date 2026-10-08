import { useState } from "react";
import { authClient } from "../lib/auth-client";

/** Asks what other players should call this person and saves it on their account. One definition,
 * used on Home and on the join page, so a new player is never shown to others as an email address. */
export function DisplayNameForm({
  heading = "What should we call you?",
  description = "Other players see this name on Standings. You can change it any time on the Me page.",
  buttonLabel = "Save name",
  onSaved,
}: {
  heading?: string;
  description?: string;
  buttonLabel?: string;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (clean === "" || clean.includes("@")) {
      setError("Type the name you'd like other players to see.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authClient.updateUser({ name: clean });
      onSaved(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-label="Display name" className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
      <label htmlFor="display-name" className="block font-semibold text-brand-text">
        {heading}
      </label>
      <p className="mt-1 text-sm text-brand-muted">{description}</p>
      <input
        id="display-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        maxLength={60}
        className="mt-3 min-h-11 w-full rounded-[12px] border border-brand-border bg-brand-bg px-3 text-brand-text focus:border-brand-accent focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
