ALTER TABLE "satellites" ALTER COLUMN "satellite_url" SET DEFAULT 'http://127.0.0.1:3001';--> statement-breakpoint
ALTER TABLE "satellites" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "satellites" ADD COLUMN "mcp_status" text;