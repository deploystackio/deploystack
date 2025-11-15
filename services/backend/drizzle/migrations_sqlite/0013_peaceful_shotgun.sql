CREATE TABLE `mcpToolMetadata` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`team_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`input_schema` text,
	`token_count` integer DEFAULT 0 NOT NULL,
	`discovered_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `mcpServerInstallations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_tool_metadata_installation_idx` ON `mcpToolMetadata` (`installation_id`);--> statement-breakpoint
CREATE INDEX `mcp_tool_metadata_team_idx` ON `mcpToolMetadata` (`team_id`);--> statement-breakpoint
CREATE INDEX `mcp_tool_metadata_unique_installation_tool` ON `mcpToolMetadata` (`installation_id`,`tool_name`);