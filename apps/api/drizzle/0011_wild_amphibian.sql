CREATE TABLE "tv_playlist_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"pool_id" uuid,
	"position" integer NOT NULL,
	"seconds" integer DEFAULT 15 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tv_playlist_slides_position_unique" UNIQUE("playlist_id","position")
);
--> statement-breakpoint
CREATE TABLE "tv_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"playlist_id" uuid,
	"show_qr" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tv_screens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "tv_playlist_slides" ADD CONSTRAINT "tv_playlist_slides_playlist_id_tv_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."tv_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_playlist_slides" ADD CONSTRAINT "tv_playlist_slides_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_screens" ADD CONSTRAINT "tv_screens_playlist_id_tv_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."tv_playlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tv_playlists_name_lower_idx" ON "tv_playlists" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "tv_screens_name_lower_idx" ON "tv_screens" USING btree (lower("name"));