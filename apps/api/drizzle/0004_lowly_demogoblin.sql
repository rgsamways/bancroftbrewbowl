CREATE TYPE "public"."pool_type" AS ENUM('survivor', 'pick_em');--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "type" "pool_type" DEFAULT 'survivor' NOT NULL;