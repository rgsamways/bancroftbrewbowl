import { teamCircleStyle, teamNickname } from "../lib/teams";

export type TeamCardMark =
  | { kind: "none" }
  | { kind: "selected" }
  | { kind: "picked" } // pick 'em: saved
  | { kind: "yourPick" } // survivor: saved
  | { kind: "used"; week: number }
  | { kind: "label"; text: string; tone?: "good" | "bad" | "muted" };

/** One team in one game. Big enough to tap with a thumb. Used teams are dimmed and cannot
 * be tapped; a card with no `onSelect` is read-only. */
export function TeamCard({
  code,
  mark,
  onSelect,
  disabled,
}: {
  code: string;
  mark: TeamCardMark;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const used = mark.kind === "used";
  const active = mark.kind === "selected" || mark.kind === "picked" || mark.kind === "yourPick";
  const interactive = Boolean(onSelect) && !used && !disabled;

  let note: string | null = null;
  if (mark.kind === "selected") note = "Selected";
  else if (mark.kind === "picked") note = "Picked";
  else if (mark.kind === "yourPick") note = "Your pick";
  else if (mark.kind === "used") note = `Used week ${mark.week}`;
  else if (mark.kind === "label") note = mark.text;

  const noteTone =
    mark.kind === "label" && mark.tone === "good"
      ? "text-brand-success"
      : mark.kind === "label" && mark.tone === "bad"
        ? "text-brand-danger"
        : active
          ? "text-brand-accent"
          : "text-brand-faint";

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-pressed={interactive || active ? active : undefined}
      onClick={onSelect}
      className={`flex min-h-16 flex-1 items-center gap-3 rounded-[14px] border px-3 py-2 text-left disabled:cursor-default ${
        active ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-brand-surface"
      } ${used ? "opacity-45" : ""}`}
    >
      <span
        aria-hidden="true"
        data-testid="team-circle"
        style={teamCircleStyle(code)}
        className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-bold ${used ? "saturate-[.4]" : ""}`}
      >
        {code}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-semibold text-brand-text">
          {code} <span className="font-normal text-brand-muted">{teamNickname(code)}</span>
        </span>
        {note && <span className={`text-xs ${noteTone}`}>{note}</span>}
      </span>
    </button>
  );
}
