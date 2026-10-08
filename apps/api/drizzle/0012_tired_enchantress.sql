CREATE TABLE "calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"entry_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"type" text NOT NULL,
	"note" text,
	"link_kind" text,
	"link_target" text,
	"link_label" text,
	"repeat" text DEFAULT 'none' NOT NULL,
	"repeat_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"exception_date" date NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"title" text,
	"start_time" time,
	"end_time" time,
	"type" text,
	"note" text,
	"link_kind" text,
	"link_target" text,
	"link_label" text,
	CONSTRAINT "calendar_exceptions_entry_date_unique" UNIQUE("entry_id","exception_date")
);
--> statement-breakpoint
ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_entry_id_calendar_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."calendar_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_entries_date_idx" ON "calendar_entries" USING btree ("entry_date");