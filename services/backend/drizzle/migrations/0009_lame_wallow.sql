ALTER TABLE "mcpServers" ADD COLUMN "health_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcpServers" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mcpServers" ADD COLUMN "health_check_error" text;