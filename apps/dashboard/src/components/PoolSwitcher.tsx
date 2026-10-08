import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SummaryEntry } from "@bbb/shared";
import { entryNeed } from "../lib/entryNeed";

// Home's pool switcher: the shown pool's name with a chevron; opening it lists the person's
// pools with what needs doing in each. Shown only with two or more pools. Choosing one calls
// onSelect and closes the list. See openspec/changes/pool-list-switcher.

export function PoolSwitcher({
  entries,
  selectedId,
  onSelect,
}: {
  entries: SummaryEntry[];
  selectedId: string;
  onSelect: (entryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length < 2) return null;
  const selected = entries.find((e) => e.entryId === selectedId) ?? entries[0]!;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[12px] border border-brand-border bg-brand-surface px-4 text-left"
      >
        <span className="min-w-0 break-words font-semibold text-brand-text">{selected.poolName}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-brand-muted ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul aria-label="Your pools" className="mt-2 divide-y divide-brand-border rounded-[12px] border border-brand-border bg-brand-surface">
          {entries.map((e) => (
            <li key={e.entryId}>
              <button
                type="button"
                aria-current={e.entryId === selected.entryId ? "true" : undefined}
                onClick={() => {
                  onSelect(e.entryId);
                  setOpen(false);
                }}
                className={`block min-h-11 w-full px-4 py-2.5 text-left ${e.entryId === selected.entryId ? "bg-brand-accent-soft" : ""}`}
              >
                <span className="block break-words font-semibold text-brand-text">{e.poolName}</span>
                <span className="block text-sm text-brand-muted">{entryNeed(e)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
