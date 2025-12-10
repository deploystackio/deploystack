ALTER TABLE "mcpServerInstallations" ADD COLUMN "status" text DEFAULT 'provisioning' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "status_message" text;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "status_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "last_credential_check_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "mcp_installations_status_idx" ON "mcpServerInstallations" USING btree ("status");