import { useEffect, useState } from "react";
import { SIGN_IN_FAILED_MESSAGE, safeDestination } from "@bbb/shared";
import { authClient } from "../lib/auth-client";
import { PublicPage } from "../components/PublicPage";

type Tab = "link" | "password";

const RESEND_WAIT_SECONDS = 30;
const LAST_EMAIL_KEY = "bbb:last-email";
const OFFLINE_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const LINK_NOT_SENT_MESSAGE = "We couldn't send the link. Check your connection and try again.";

const inputClass =
  "rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none";
const primaryButton =
  "min-h-11 rounded bg-brand-accent px-3 py-2 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40";
const secondaryButton =
  "min-h-11 rounded border border-brand-border px-3 py-2 font-semibold text-brand-text hover:border-brand-accent disabled:opacity-40";

function rememberEmail(email: string) {
  try {
    sessionStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // Private browsing can refuse storage; prefilling is only a convenience.
  }
}

function recalledEmail() {
  try {
    return sessionStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** better-auth sends a used, expired or invalid link back to the app with ?error=... */
function readLinkProblem() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("error")) return false;
  params.delete("error");
  const rest = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  return true;
}

// Read once when the page loads (React may run a component's initial state twice in
// development, and the first read clears the marker from the address).
let pendingLinkProblem = readLinkProblem();

export function Login() {
  const [linkProblem, setLinkProblemState] = useState(() => pendingLinkProblem);
  function setLinkProblem(value: boolean) {
    pendingLinkProblem = value;
    setLinkProblemState(value);
  }
  const [tab, setTab] = useState<Tab>("link");
  const [email, setEmail] = useState(linkProblem ? recalledEmail : "");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while the resend wait is running.
  useEffect(() => {
    if (!sent || now >= resendAt) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [sent, now, resendAt]);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  async function sendLink() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: signInError } = await authClient.signIn.magicLink({
        email,
        // Back to the page they opened (a shared join link, say), never anywhere outside the app.
        callbackURL: window.location.origin + safeDestination(window.location.pathname + window.location.search),
      });
      // A dropped connection can come back as neither data nor an error, so success
      // means the service actually answered.
      if (signInError || !data) {
        setError(LINK_NOT_SENT_MESSAGE);
        return;
      }
      rememberEmail(email);
      const sentAt = Date.now();
      setNow(sentAt);
      setResendAt(sentAt + RESEND_WAIT_SECONDS * 1000);
      setSent(true);
    } catch {
      setError(LINK_NOT_SENT_MESSAGE);
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
        // A dropped connection has no status; every real refusal gets the one message,
        // whether the email, the password or both are wrong.
        setError(signInError.status ? SIGN_IN_FAILED_MESSAGE : OFFLINE_MESSAGE);
      }
      // On success the session store updates and App swaps to the signed-in screens.
    } catch {
      setError(OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (linkProblem) {
    return (
      <PublicPage>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">That link didn't work</h1>
        <p className="mt-3 text-sm text-brand-muted">
          Sign-in links only work once, and only for a short while. It may have expired, or already been used.
        </p>
        <button
          type="button"
          onClick={() => {
            setLinkProblem(false);
            setTab("link");
          }}
          className={`${primaryButton} mt-6`}
        >
          Email me a new link
        </button>
        <p className="mt-4 text-sm text-brand-muted">Tip: open the new link on the same phone you asked for it on.</p>
      </PublicPage>
    );
  }

  if (sent) {
    return (
      <PublicPage>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Check your email</h1>
        <p className="mt-3 text-sm text-brand-muted">
          We sent a sign-in link to <span className="text-brand-text">{email}</span>.
        </p>
        <button type="button" disabled={busy || secondsLeft > 0} onClick={sendLink} className={`${secondaryButton} mt-6`}>
          {secondsLeft > 0 ? `Resend link in ${secondsLeft}s` : "Resend link"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-brand-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
            setTab("link");
          }}
          className="mt-4 self-start text-sm text-brand-muted underline hover:text-brand-text"
        >
          Use a different email
        </button>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">Sign in to play</h1>

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
            Email me a sign-in link
          </button>
          {error && (
            <p role="alert" className="text-sm text-brand-danger">
              {error}
            </p>
          )}
          <p className="text-sm text-brand-muted">
            First time here? Same thing. Your account is created when you tap the link.
          </p>
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
          <button type="button" disabled={busy || !email} onClick={sendLink} className={secondaryButton}>
            Email me a sign-in link instead
          </button>
          <p className="text-sm text-brand-muted">
            No password yet? That's fine. Sign in with a link, then set one on the Me tab if you'd like.
          </p>
        </form>
      )}
    </PublicPage>
  );
}
