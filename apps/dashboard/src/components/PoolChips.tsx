/** One chip per pool, shown only when a player is in more than one. */
export function PoolChips({
  pools,
  selectedId,
  onSelect,
}: {
  pools: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (pools.length < 2) return null;
  return (
    <div role="group" aria-label="Your pools" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {pools.map((pool) => (
        <button
          key={pool.id}
          type="button"
          aria-pressed={pool.id === selectedId}
          onClick={() => onSelect(pool.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
            pool.id === selectedId
              ? "border-brand-accent bg-brand-accent-soft text-brand-text"
              : "border-brand-border bg-brand-surface text-brand-muted"
          }`}
        >
          {pool.name}
        </button>
      ))}
    </div>
  );
}
