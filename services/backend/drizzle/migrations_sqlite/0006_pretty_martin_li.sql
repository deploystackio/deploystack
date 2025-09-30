ALTER TABLE `mcpServers` RENAME COLUMN "github_url" TO "repository_url";--> statement-breakpoint
ALTER TABLE `mcpServers` RENAME COLUMN "homepage_url" TO "website_url";--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `official_name` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `version` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `repository_source` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `repository_id` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `repository_subfolder` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `packages` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `remotes` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `meta_extensions` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `synced_from_official_registry` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `official_registry_server_id` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `official_registry_version_id` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `official_registry_published_at` integer;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `official_registry_updated_at` integer;--> statement-breakpoint
CREATE INDEX `mcp_servers_official_name_idx` ON `mcpServers` (`official_name`);--> statement-breakpoint
CREATE INDEX `mcp_servers_synced_flag_idx` ON `mcpServers` (`synced_from_official_registry`);--> statement-breakpoint
CREATE INDEX `mcp_servers_registry_server_id_idx` ON `mcpServers` (`official_registry_server_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_repository_url_idx` ON `mcpServers` (`repository_url`);--> statement-breakpoint
ALTER TABLE `mcpServers` DROP COLUMN `installation_methods`;