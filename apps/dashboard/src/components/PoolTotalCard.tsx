import { formatPoolTotal, POOL_TOTAL_NOTE } from "@bbb/shared";

/** The display-only pool total. Shows nothing when the pool has no total. */
export function PoolTotalCard({ cents }: { cents: number | null | undefined }) {
  if (cents === null || cents === undefined) return null;
  return (
    <section className="mb-6 rounded-[14px] border border-brand-border bg-brand-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-brand-muted">Pool total</span>
        <span className="text-2xl font-semibold text-brand-text">{formatPoolTotal(cents)}</span>
      </div>
      <p className="mt-1 text-xs text-brand-faint">{POOL_TOTAL_NOTE}</p>
    </section>
  );
}
