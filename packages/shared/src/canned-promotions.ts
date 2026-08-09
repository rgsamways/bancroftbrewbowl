import { z } from "zod";
import { PROMOTION_KINDS } from "./enums.js";

export const cannedPromotionConfigSchema = z.object({
  // Only meaningful for the "milestone_reward" kind — the week numbers an
  // entry must survive to before it counts as reaching a milestone.
  milestone_weeks: z.array(z.number().int().min(1).max(22)).default([]),
});

export type CannedPromotionConfig = z.infer<typeof cannedPromotionConfigSchema>;

export const defaultCannedPromotionConfig: CannedPromotionConfig = cannedPromotionConfigSchema.parse({});

export const CANNED_PROMOTION_LABELS: Record<(typeof PROMOTION_KINDS)[number], string> = {
  survivor_sunday: "Survivor Sunday",
  elimination_consolation: "Elimination Consolation",
  milestone_reward: "Milestone Rewards",
  hot_team_special: "Hot-Team Special",
};
