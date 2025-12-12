CREATE TABLE "oauthPendingFlows" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"server_id" text NOT NULL,
	"created_by" text NOT NULL,
	"oauth_state" text NOT NULL,
	"oauth_code_verifier" text NOT NULL,
	"oauth_client_id" text NOT NULL,
	"oauth_client_secret" text,
	"oauth_provider_id" text,
	"oauth_token_endpoint" text NOT NULL,
	"oauth_token_endpoint_auth_method" text NOT NULL,
	"installation_name" text NOT NULL,
	"installation_type" text DEFAULT 'global' NOT NULL,
	"team_config" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauthPendingFlows" ADD CONSTRAINT "oauthPendingFlows_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthPendingFlows" ADD CONSTRAINT "oauthPendingFlows_server_id_mcpServers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcpServers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthPendingFlows" ADD CONSTRAINT "oauthPendingFlows_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthPendingFlows" ADD CONSTRAINT "oauthPendingFlows_oauth_provider_id_mcpOauthProviders_id_fk" FOREIGN KEY ("oauth_provider_id") REFERENCES "public"."mcpOauthProviders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_pending_flows_state_idx" ON "oauthPendingFlows" USING btree ("oauth_state");--> statement-breakpoint
CREATE INDEX "oauth_pending_flows_expires_at_idx" ON "oauthPendingFlows" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_pending_flows_team_server_idx" ON "oauthPendingFlows" USING btree ("team_id","server_id");--> statement-breakpoint
CREATE INDEX "oauth_pending_flows_created_by_idx" ON "oauthPendingFlows" USING btree ("created_by");