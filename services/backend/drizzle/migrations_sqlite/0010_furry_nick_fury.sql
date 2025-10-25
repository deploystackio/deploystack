ALTER TABLE `mcpServers` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE INDEX `mcp_servers_source_idx` ON `mcpServers` (`source`);