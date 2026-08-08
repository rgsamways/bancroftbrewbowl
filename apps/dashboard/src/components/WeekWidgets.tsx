export type Week = { weekNumber: number; pickDeadline: string; locked: boolean };

export function WeekPills({
  weeks,
  selectedWeek,
  onSelect,
}: {
  weeks: Week[];
  selectedWeek: number | null;
  onSelect: (week: number) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {weeks.map((w) => (
        <button
          key={w.weekNumber}
          onClick={() => onSelect(w.weekNumber)}
          className={`rounded px-3 py-1 text-sm font-medium ${
            w.weekNumber === selectedWeek
              ? "bg-brand-accent text-white"
              : "bg-brand-surface text-brand-muted hover:text-brand-text"
          }`}
        >
          {w.weekNumber}
        </button>
      ))}
    </div>
  );
}

export function WeekStatus({ week }: { week: Week }) {
  return (
    <p className="mb-3 text-sm text-brand-muted">
      Pick deadline: {new Date(week.pickDeadline).toLocaleString()}{" "}
      {week.locked ? (
        <span className="rounded bg-brand-surface-raised px-1.5 py-0.5 text-xs text-brand-text">locked</span>
      ) : (
        <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">open</span>
      )}
    </p>
  );
}
