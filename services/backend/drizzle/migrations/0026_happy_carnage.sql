ALTER TABLE "mcpServerInstances" ADD COLUMN "instance_path" text;--> statement-breakpoint
ALTER TABLE "mcpServerInstances" ADD COLUMN "instance_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_instances_instance_path_idx" ON "mcpServerInstances" USING btree ("instance_path");