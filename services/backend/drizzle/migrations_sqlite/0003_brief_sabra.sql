ALTER TABLE `mcpServers` ADD `transport_type` text DEFAULT 'stdio' NOT NULL;--> statement-breakpoint
ALTER TABLE `mcpServers` DROP COLUMN `default_config`;