import { z } from "zod";
import { TIE_HANDLING, TIEBREAKERS, PICK_DEADLINE_RULES } from "./enums.js";

export const survivorRulesConfigSchema = z.object({
  allow_repeat_teams: z.boolean().default(false),
  tie_counts_as: z.enum(TIE_HANDLING).default("elimination"),
  mulligans_allowed: z.number().int().min(0).default(0),
  double_pick_weeks: z.array(z.number().int().min(1).max(22)).default([]),
  tiebreaker: z.enum(TIEBREAKERS).default("playoff_performance"),
  pick_deadline_rule: z.enum(PICK_DEADLINE_RULES).default("first_kickoff_of_week"),
});

export type SurvivorRulesConfig = z.infer<typeof survivorRulesConfigSchema>;

export const defaultSurvivorRulesConfig: SurvivorRulesConfig = survivorRulesConfigSchema.parse({});
