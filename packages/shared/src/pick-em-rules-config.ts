import { z } from "zod";
import { PICK_EM_TIE_HANDLING, PICK_DEADLINE_RULES } from "./enums.js";

export const pickEmRulesConfigSchema = z.object({
  tie_handling: z.enum(PICK_EM_TIE_HANDLING).default("void"),
  pick_deadline_rule: z.enum(PICK_DEADLINE_RULES).default("first_kickoff_of_week"),
});

export type PickEmRulesConfig = z.infer<typeof pickEmRulesConfigSchema>;

export const defaultPickEmRulesConfig: PickEmRulesConfig = pickEmRulesConfigSchema.parse({});
