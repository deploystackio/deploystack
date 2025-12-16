ALTER TABLE "mcpRequestLogs" ADD COLUMN "tool_response" jsonb;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD COLUMN "settings" jsonb DEFAULT '{}';