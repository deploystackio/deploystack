DROP INDEX "mcp_installations_status_idx";--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" DROP COLUMN "status_message";--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" DROP COLUMN "status_updated_at";--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" DROP COLUMN "last_health_check_at";--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" DROP COLUMN "last_credential_check_at";