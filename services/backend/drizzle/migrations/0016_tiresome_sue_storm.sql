CREATE TABLE "mcpServerInstances" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"status_message" text,
	"status_updated_at" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"last_credential_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcpServerInstances" ADD CONSTRAINT "mcpServerInstances_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerInstances" ADD CONSTRAINT "mcpServerInstances_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_instances_installation_user_idx" ON "mcpServerInstances" USING btree ("installation_id","user_id");--> statement-breakpoint
CREATE INDEX "mcp_instances_user_idx" ON "mcpServerInstances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mcp_instances_status_idx" ON "mcpServerInstances" USING btree ("status");