CREATE TABLE "deploymentCredentials" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"source" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"scopes" text[],
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deploymentCredentials_team_id_source_unique" UNIQUE("team_id","source")
);
--> statement-breakpoint
CREATE TABLE "deploymentSettings" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"auto_deploy_enabled" boolean DEFAULT true NOT NULL,
	"webhook_id" text,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deploymentSettings_server_id_unique" UNIQUE("server_id")
);
--> statement-breakpoint
ALTER TABLE "mcpServers" ADD COLUMN "git_commit_sha" text;--> statement-breakpoint
ALTER TABLE "deploymentCredentials" ADD CONSTRAINT "deploymentCredentials_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploymentSettings" ADD CONSTRAINT "deploymentSettings_server_id_mcpServers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcpServers"("id") ON DELETE cascade ON UPDATE no action;