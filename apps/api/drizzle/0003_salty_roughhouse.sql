CREATE TYPE "public"."promotion_kind" AS ENUM('survivor_sunday', 'elimination_consolation', 'milestone_reward', 'hot_team_special');--> statement-breakpoint
CREATE TABLE "canned_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{"milestone_weeks":[]}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "canned_promotions_kind_unique" UNIQUE("kind")
);
