CREATE TABLE "admin_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pool_id" uuid NOT NULL,
	"wipeout_id" uuid,
	"entry_id" uuid,
	"payload" jsonb NOT NULL,
	"requested_by" text,
	"requested_by_name" text NOT NULL,
	"decided_by" text,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_wipeout_id_wipeout_events_id_fk" FOREIGN KEY ("wipeout_id") REFERENCES "public"."wipeout_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_requests_wipeout_pending_unique" ON "admin_requests" USING btree ("wipeout_id") WHERE "admin_requests"."status" = 'pending' AND "admin_requests"."wipeout_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_requests_entry_pending_unique" ON "admin_requests" USING btree ("entry_id") WHERE "admin_requests"."status" = 'pending' AND "admin_requests"."entry_id" IS NOT NULL;