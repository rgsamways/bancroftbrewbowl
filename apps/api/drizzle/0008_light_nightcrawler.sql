CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"section" text NOT NULL,
	"name" text NOT NULL,
	"style" text,
	"abv" text,
	"description" text,
	"price_cents" integer,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "menu_items_kind_section_idx" ON "menu_items" USING btree ("kind","section","sort_order");