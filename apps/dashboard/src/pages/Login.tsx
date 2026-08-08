import { useState } from "react";
import { authClient } from "../lib/auth-client";

export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      callbackURL: window.location.origin,
    });
    if (signInError) {
      setError(signInError.message ?? "Something went wrong");
      return;
    }
    setSent(true);
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
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-brand-text">
          Bancroft Brew Bowl
        </h1>
        <p className="mt-1 text-sm text-brand-muted">Sign in with your email to continue.</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover"
          >
            Send magic link
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}
