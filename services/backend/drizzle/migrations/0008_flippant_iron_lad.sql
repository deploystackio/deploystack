CREATE TABLE "mcpRequestLogs" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text,
	"tool_name" text NOT NULL,
	"tool_params" jsonb,
	"response_time_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpServerLogs" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"team_id" text NOT NULL,
	"log_type" text DEFAULT 'mcp_server_log' NOT NULL,
	"log_level" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcpRequestLogs" ADD CONSTRAINT "mcpRequestLogs_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpRequestLogs" ADD CONSTRAINT "mcpRequestLogs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpRequestLogs" ADD CONSTRAINT "mcpRequestLogs_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerLogs" ADD CONSTRAINT "mcpServerLogs_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerLogs" ADD CONSTRAINT "mcpServerLogs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_request_logs_installation_created_idx" ON "mcpRequestLogs" USING btree ("installation_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_request_logs_team_idx" ON "mcpRequestLogs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "mcp_request_logs_created_at_idx" ON "mcpRequestLogs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mcp_server_logs_installation_created_idx" ON "mcpServerLogs" USING btree ("installation_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_server_logs_team_idx" ON "mcpServerLogs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "mcp_server_logs_created_at_idx" ON "mcpServerLogs" USING btree ("created_at");