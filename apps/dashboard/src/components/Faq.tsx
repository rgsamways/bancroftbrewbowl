import type { ReactNode } from "react";

// Short questions with answers that open and close. Native `details`, so it works without script.

export function FaqGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-muted">{title}</h2>
      <div className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">{children}</div>
    </section>
  );
}

export function Faq({ q, children, open = false }: { q: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-brand-border last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-brand-text [&::-webkit-details-marker]:hidden">
        {q}
        <span aria-hidden="true" className="text-brand-faint transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="px-4 pb-4 text-sm text-brand-muted">{children}</div>
    </details>
  );
}
