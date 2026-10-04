import type { PickEmRulesConfig, PoolType, SurvivorRulesConfig } from "@bbb/shared";

export type PoolRow = {
  id: string;
  name: string;
  seasonYear: number;
  status: "draft" | "active" | "completed";
  type: PoolType;
  rules: SurvivorRulesConfig | PickEmRulesConfig;
  poolTotalCents: number | null;
};

export type RosterEntry = {
  id: string;
  displayName: string;
  email: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  points?: number;
  invited?: boolean;
  isYou?: boolean;
};

export const kindLabel = (type: PoolType) => (type === "survivor" ? "Survivor" : "Pick 'em");

/** Unlocked while the rules can still change; Locked once the pool is running; Finished at the end. */
export const statusLabel = (status: PoolRow["status"]) =>
  status === "draft" ? "Unlocked" : status === "active" ? "Locked" : "Finished";

export const buttonClass =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-50";
export const secondaryButtonClass =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent disabled:opacity-50";
export const inputClass =
  "min-h-11 w-full rounded-[12px] border border-brand-border bg-brand-surface px-3 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none disabled:opacity-60";
