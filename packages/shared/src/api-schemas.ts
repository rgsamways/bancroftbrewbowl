import { z } from "zod";
import { rulesConfigSchema } from "./rules-config.js";
import { cannedPromotionConfigSchema } from "./canned-promotions.js";
import { NFL_TEAM_CODES } from "./teams.js";
import { POOL_STATUSES } from "./enums.js";

export const createPoolSchema = z.object({
  name: z.string().min(1),
  season_year: z.number().int().min(2000).max(2100),
  rules: rulesConfigSchema.partial().optional(),
});
export type CreatePoolInput = z.infer<typeof createPoolSchema>;

export const updatePoolSchema = z.object({
  name: z.string().min(1).optional(),
  season_year: z.number().int().min(2000).max(2100).optional(),
  status: z.enum(POOL_STATUSES).optional(),
  rules: rulesConfigSchema.partial().optional(),
});
export type UpdatePoolInput = z.infer<typeof updatePoolSchema>;

export const deletePoolSchema = z.object({
  confirm_name: z.string().min(1),
});
export type DeletePoolInput = z.infer<typeof deletePoolSchema>;

export const resolveWipeoutSchema = z.object({
  surviving_entry_ids: z.array(z.string().uuid()),
});
export type ResolveWipeoutInput = z.infer<typeof resolveWipeoutSchema>;

export const createEntrySchema = z.object({
  display_name: z.string().min(1),
  email: z.string().email(),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const enterGameResultSchema = z.object({
  result: z.enum(["home_win", "away_win", "tie"]),
});
export type EnterGameResultInput = z.infer<typeof enterGameResultSchema>;

export const updateGameScoreSchema = z
  .object({
    home_score: z.number().int().min(0).optional(),
    away_score: z.number().int().min(0).optional(),
  })
  .refine((body) => body.home_score !== undefined || body.away_score !== undefined, {
    message: "At least one of home_score or away_score is required",
  });
export type UpdateGameScoreInput = z.infer<typeof updateGameScoreSchema>;

export const submitPickSchema = z.object({
  week_number: z.number().int().min(1).max(22),
  team_code: z.enum(NFL_TEAM_CODES),
});
export type SubmitPickInput = z.infer<typeof submitPickSchema>;

export const createPromotionSchema = z.object({
  season_year: z.number().int().min(2000).max(2100),
  week_number: z.number().int().min(1).max(22),
  title: z.string().min(1),
  description: z.string().min(1),
});
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = createPromotionSchema.partial();
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const updateCannedPromotionSchema = z.object({
  enabled: z.boolean().optional(),
  config: cannedPromotionConfigSchema.partial().optional(),
});
export type UpdateCannedPromotionInput = z.infer<typeof updateCannedPromotionSchema>;
