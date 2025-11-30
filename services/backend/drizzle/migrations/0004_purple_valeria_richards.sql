CREATE TABLE "mcpOauthProviders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon_url" text,
	"auth_server_patterns" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"authorization_endpoint" text NOT NULL,
	"token_endpoint" text NOT NULL,
	"default_scopes" text,
	"pkce_required" boolean DEFAULT true NOT NULL,
	"token_endpoint_auth_method" text DEFAULT 'client_secret_post' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "oauth_provider_id" text;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "oauth_token_endpoint" text;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "oauth_token_endpoint_auth_method" text;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_providers_slug_idx" ON "mcpOauthProviders" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mcp_oauth_providers_enabled_idx" ON "mcpOauthProviders" USING btree ("enabled");--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD CONSTRAINT "mcpServerInstallations_oauth_provider_id_mcpOauthProviders_id_fk" FOREIGN KEY ("oauth_provider_id") REFERENCES "public"."mcpOauthProviders"("id") ON DELETE set null ON UPDATE no action;