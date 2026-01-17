ALTER TABLE "teams" ADD COLUMN "allow_github_mcp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "allow_private_github_repos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "github_mcp_limit" integer DEFAULT 1 NOT NULL;