CREATE TABLE "wipeout_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"game_id" uuid NOT NULL,
	"candidate_entry_ids" jsonb NOT NULL,
	"surviving_entry_ids" jsonb,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "picks" DROP CONSTRAINT "picks_entry_week_unique";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "mulligans_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wipeout_events" ADD CONSTRAINT "wipeout_events_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wipeout_events" ADD CONSTRAINT "wipeout_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wipeout_events" ADD CONSTRAINT "wipeout_events_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wipeout_events_pool_game_unresolved_unique" ON "wipeout_events" USING btree ("pool_id","game_id") WHERE "wipeout_events"."resolved_at" IS NULL;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_entry_week_team_unique" UNIQUE("entry_id","week_number","team_code");