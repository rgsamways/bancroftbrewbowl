import { useState } from "react";
import { INSTALL_DISMISSED_KEY, isStandalone, shouldShowInstallCard } from "../lib/install";

// "Add Brew Bowl to your home screen": one set of steps, no browser sniffing. Remembered on the
// phone only (no server).

function wasDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallCard() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (!shouldShowInstallCard({ standalone: isStandalone(), dismissed })) return null;

  function notNow() {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      /* private mode: it just comes back next time */
    }
    setDismissed(true);
  }

  return (
    <section aria-label="Add to home screen" className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
      <p className="font-semibold text-brand-text">Add Brew Bowl to your home screen</p>
      <p className="mt-1 text-sm text-brand-muted">Open it like an app, no searching for the link.</p>
      <ol className="mt-3 space-y-2 text-sm text-brand-text">
        {["Tap the Share button in your browser", "Choose Add to Home Screen", "Tap Add"].map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-accent-soft text-xs font-semibold text-brand-accent">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <button type="button" onClick={notNow} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent">
        Not now
      </button>
    </section>
  );
}
