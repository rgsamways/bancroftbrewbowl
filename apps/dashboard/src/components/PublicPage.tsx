import type { ReactNode } from "react";

/** The frame for every page shown before sign-in: logo and name, no tab bar, and the
 * age and responsible-drinking lines. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10">
      <div className="flex items-center gap-2.5 pt-6">
        <div
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-accent text-lg font-bold text-brand-accent-ink"
        >
          B
        </div>
        <div className="leading-tight">
          <p className="text-base font-semibold text-brand-text">Brew Bowl</p>
          <p className="text-xs text-brand-muted">Bancroft Brewing Co.</p>
        </div>
      </div>
      <main className="flex flex-1 flex-col justify-start pt-12">{children}</main>
      <div className="mt-8 space-y-1 text-xs text-brand-faint">
        <p>You must be 19 or older to play.</p>
        <p>Please drink responsibly.</p>
      </div>
    </div>
  );
}
