import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { initials } from "@bbb/shared";
import { useApi } from "../../lib/useApi";
import { teamNickname } from "../../lib/teams";
import type { PoolRow, RosterEntry } from "./shared";

type WeekRow = { weekNumber: number; locked: boolean; completed: boolean };
type PickRow = { entryId: string; weekNumber: number; teamCode: string | null; result: "pending" | "win" | "loss" | "tie" | null; submitted?: boolean };
type Chip = "alive" | "nopick" | "lost" | "picked";

/** One week of a Survivor pool's picks. Before the week locks the server hides every team except
 * the viewer's own, so this screen can only show who has picked, never what. */
export function PicksTab({ pool }: { pool: PoolRow }) {
  const { data: roster } = useApi<RosterEntry[]>(`/pools/${pool.id}/entries`);
  const { data: weeks } = useApi<WeekRow[]>(`/nfl/weeks?year=${pool.seasonYear}`);
  const { data: picks } = useApi<PickRow[]>(`/pools/${pool.id}/picks`);
  const [week, setWeek] = useState<number | null>(null);
  const [chip, setChip] = useState<Chip>("alive");

  if (!roster || !weeks || !picks) return null;
  if (weeks.length === 0) return <p className="text-sm text-brand-muted">No games are loaded for this season yet.</p>;

  const shown = week ?? (weeks.find((w) => !w.completed) ?? weeks[weeks.length - 1]!).weekNumber;
  const idx = weeks.findIndex((w) => w.weekNumber === shown);
  const info = weeks[idx]!;
  const later = (pool.rules as { reveal_picks?: string }).reveal_picks === "after_final_game";
  // Other players' teams show once the week has locked and, for a pool that waits, every game has a result.
  const locked = info.locked && (!later || info.completed);

  const weekPicks = picks.filter((p) => p.weekNumber === shown);
  const picksFor = (entryId: string) => weekPicks.filter((p) => p.entryId === entryId);
  const alive = roster.filter((e) => e.status === "alive");
  const hasPick = (e: RosterEntry) => picksFor(e.id).length > 0;
  const noPick = alive.filter((e) => !hasPick(e));
  const picked = alive.filter(hasPick);
  const lost = roster.filter((e) => picksFor(e.id).some((p) => p.result === "loss"));

  const chips: { key: Chip; label: string; list: RosterEntry[] }[] = locked
    ? [
        { key: "alive", label: "Alive", list: alive },
        { key: "nopick", label: "No pick", list: noPick },
        { key: "lost", label: "Lost", list: lost },
      ]
    : [
        { key: "alive", label: "Alive", list: alive },
        { key: "nopick", label: "No pick", list: noPick },
        { key: "picked", label: "Picked", list: picked },
      ];
  const active = chips.find((c) => c.key === chip) ?? chips[0]!;

  const pickText = (e: RosterEntry) => {
    const mine = picksFor(e.id);
    if (mine.length === 0) return { text: "Hasn't picked", tone: "muted" as const };
    const teams = mine.map((p) => p.teamCode).filter((t): t is string => t !== null);
    if (teams.length === 0) return { text: "Picked", sub: later ? "Team hidden until the week's games are final" : "Team hidden until the lock", tone: "muted" as const };
    const names = teams.map(teamNickname).join(" and ");
    if (e.isYou && !locked) return { text: `You · ${names}, your pick`, tone: "plain" as const };
    return { text: names, tone: "plain" as const };
  };
  const resultChip = (e: RosterEntry) => {
    if (!locked) return null; // nothing can have a result before the week locks
    const results = picksFor(e.id).map((p) => p.result);
    if (results.length === 0 || results.includes(null)) return null;
    if (results.includes("loss")) return { label: "Lost", cls: "bg-red-950 text-red-400" };
    if (results.every((r) => r === "win")) return { label: "Won", cls: "bg-emerald-950 text-emerald-400" };
    if (results.includes("tie")) return { label: "Tied", cls: "bg-brand-surface-raised text-brand-muted" };
    return { label: "Waiting", cls: "bg-brand-surface-raised text-brand-muted" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[14px] border border-brand-border bg-brand-surface p-2">
        <button
          type="button"
          aria-label="Previous week"
          disabled={idx <= 0}
          onClick={() => setWeek(weeks[idx - 1]!.weekNumber)}
          className="grid h-11 w-11 place-items-center rounded-full text-brand-text disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-brand-text">Week {shown}</p>
          <p className="text-xs text-brand-muted">
            {alive.length} alive &middot; {picked.length} picked
          </p>
        </div>
        <button
          type="button"
          aria-label="Next week"
          disabled={idx >= weeks.length - 1}
          onClick={() => setWeek(weeks[idx + 1]!.weekNumber)}
          className="grid h-11 w-11 place-items-center rounded-full text-brand-text disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <p className="text-sm text-brand-muted">
        {locked
          ? "This week has locked, so everyone can see everyone's picks. Before a week locks, even admins only see who has picked."
          : later
            ? "Teams are hidden until every game of the week has a result. That goes for everyone, admins too. You can still see who needs a nudge."
            : "Teams are hidden until the week locks. That goes for everyone, admins too. You can still see who needs a nudge."}
      </p>

      <div role="group" aria-label="Filter" className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={active.key === c.key}
            onClick={() => setChip(c.key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              active.key === c.key ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border bg-brand-surface text-brand-muted"
            }`}
          >
            {c.label} {c.list.length}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {active.list.map((e) => {
          const t = pickText(e);
          const r = resultChip(e);
          return (
            <li key={e.id} className="flex min-h-14 items-center gap-3 border-b border-brand-border px-4 py-2 last:border-b-0">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 flex-none place-items-center rounded-full border border-brand-border bg-brand-surface-raised text-xs font-semibold text-brand-text"
              >
                {initials(e.displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-brand-text">{e.displayName}</span>
                <span className={`block text-sm ${t.tone === "muted" ? "text-brand-muted" : "text-brand-text"}`}>
                  {t.text}
                  {"sub" in t && t.sub ? <span className="block text-xs text-brand-faint">{t.sub}</span> : null}
                </span>
              </span>
              {r && <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${r.cls}`}>{r.label}</span>}
            </li>
          );
        })}
        {active.list.length === 0 && <li className="px-4 py-3 text-sm text-brand-muted">Nobody here.</li>}
      </ul>
    </div>
  );
}
