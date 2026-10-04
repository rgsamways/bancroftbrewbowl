import { useEffect, useState } from "react";
import { Link } from "react-router";
import { describePasswordFailure, validatePasswordForm, type PasswordFormErrors } from "@bbb/shared";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL as string;

const inputClass =
  "rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none";

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-brand-muted">
      {props.label}
      <input
        type="password"
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        className={inputClass}
      />
      {props.error && (
        <span role="alert" className="text-brand-danger">
          {props.error}
        </span>
      )}
    </label>
  );
}

export function PasswordPage() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ hasPassword: boolean }>("/me/password")
      .then((r) => setHasPassword(r.hasPassword))
      .catch(() => setErrors(describePasswordFailure("network")));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (hasPassword === null) return;
    const found = validatePasswordForm({ current, next, confirm, hasPassword });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      if (hasPassword) {
        const { error } = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        if (error) {
          setErrors(describePasswordFailure({ code: error.code, status: error.status }));
          return;
        }
      } else {
        const response = await fetch(`${API_URL}/me/password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: next }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setErrors(describePasswordFailure({ code: body.code, status: response.status }));
          return;
        }
      }
      setSaved(true);
    } catch {
      setErrors(describePasswordFailure("network"));
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-lg px-6 pb-6">
        <h1 className="font-display text-2xl font-bold text-brand-text">Password saved</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Next time you can sign in with your email and password, or keep using an email link.
        </p>
        <Link
          to="/account"
          className="mt-6 inline-flex min-h-11 items-center rounded bg-brand-accent px-4 py-2 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover"
        >
          Back to Me
        </Link>
      </div>
    );
  }

  if (hasPassword === null) {
    return (
      <div className="mx-auto max-w-lg px-6 pb-6">
        {errors.form ? (
          <p role="alert" className="text-sm text-brand-danger">
            {errors.form}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 pb-6">
      <Link to="/account" className="text-sm text-brand-muted hover:text-brand-text">
        Me
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-brand-text">
        {hasPassword ? "Change your password" : "Set a password"}
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        {hasPassword
          ? "Enter your current one, then choose a new one."
          : "Optional. You can always sign in with an email link instead."}
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        {hasPassword && (
          <Field
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            error={errors.current}
          />
        )}
        <Field
          label="New password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          value={next}
          onChange={setNext}
          error={errors.next}
        />
        <Field
          label={hasPassword ? "Type the new one again" : "Type it again"}
          autoComplete="new-password"
          placeholder="Same password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
        />
        {errors.form && (
          <p role="alert" className="text-sm text-brand-danger">
            {errors.form}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded bg-brand-accent px-3 py-2 font-display font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40"
        >
          {hasPassword ? "Save new password" : "Save password"}
        </button>
        <p className="text-sm text-brand-muted">
          {hasPassword
            ? "Forgot your current one? Sign out and use an email link to get in. Links always work."
            : "Next time, choose the Password tab on the sign-in page."}
        </p>
      </form>
    </div>
  );
}
