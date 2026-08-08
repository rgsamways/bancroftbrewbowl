import { z } from "zod";
import { rulesConfigSchema } from "./rules-config.js";
import { NFL_TEAM_CODES } from "./teams.js";

export const createPoolSchema = z.object({
  name: z.string().min(1),
  season_year: z.number().int().min(2000).max(2100),
  rules: rulesConfigSchema.partial().optional(),
});
export type CreatePoolInput = z.infer<typeof createPoolSchema>;

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
