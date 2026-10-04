ALTER TABLE "promotions" ALTER COLUMN "season_year" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ALTER COLUMN "week_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "kind" text DEFAULT 'announcement' NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "menu_item_id" uuid;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "days" integer[];--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "on_date" date;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "tag" text;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;