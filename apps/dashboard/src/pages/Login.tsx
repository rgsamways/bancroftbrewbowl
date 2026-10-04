import { useState } from "react";
import { SIGN_IN_FAILED_MESSAGE } from "@bbb/shared";
import { authClient } from "../lib/auth-client";

type Tab = "link" | "password";

const inputClass =
  "rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none";
const primaryButton =
  "rounded bg-brand-accent px-3 py-2 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40";

function Legal() {
  return (
    <div className="mt-8 space-y-1 text-xs text-brand-faint">
      <p>You must be 19 or older to play.</p>
      <p>Please drink responsibly.</p>
    </div>
  );
}

export function Login() {
  const [tab, setTab] = useState<Tab>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  async function sendLink() {
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.magicLink({
        email,
        callbackURL: window.location.origin,
      });
      if (signInError) {
        setError(signInError.message ?? "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
    await sendLink();
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        // A dropped connection shows up as status 0 or a missing status; every real
        // refusal gets the one message, whether the email, the password or both are wrong.
        const offline = !signInError.status;
        setError(
          offline ? "We couldn't reach the server. Check your connection and try again." : SIGN_IN_FAILED_MESSAGE
        );
        return;
      }
      // The session store updates and App swaps to the signed-in screens.
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-6">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-brand-text">Check your email</h1>
          <p className="mt-2 text-sm text-brand-muted">We sent a sign-in link to {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-brand-text">Sign in to play</h1>

        <div role="tablist" aria-label="Sign-in method" className="mt-5 grid grid-cols-2 rounded bg-brand-surface p-1">
          {(
            [
              ["link", "Email link"],
              ["password", "Password"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => switchTab(id)}
              className={`min-h-11 rounded px-3 py-2 text-sm font-semibold ${
                tab === id ? "bg-brand-surface-raised text-brand-text" : "text-brand-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "link" ? (
          <form onSubmit={handleLinkSubmit} className="mt-5 flex flex-col gap-3">
            <p className="text-sm text-brand-muted">Enter your email and we'll send you a link. No password needed.</p>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className={primaryButton}>
              Send magic link
            </button>
            {error && (
              <p role="alert" className="text-sm text-brand-danger">
                {error}
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="mt-5 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
              aria-label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
            {error && (
              <p role="alert" className="text-sm text-brand-danger">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={primaryButton}>
              Sign in
            </button>
            <p className="text-center text-xs text-brand-faint">or</p>
            <button
              type="button"
              disabled={busy || !email}
              onClick={sendLink}
              className="min-h-11 rounded border border-brand-border px-3 py-2 font-semibold text-brand-text hover:border-brand-accent disabled:opacity-40"
            >
              Email me a sign-in link instead
            </button>
            <p className="text-sm text-brand-muted">
              No password yet? That's fine. Sign in with a link, then set one on the Me tab if you'd like.
            </p>
          </form>
        )}

        <Legal />
      </div>
    </div>
  );
}
