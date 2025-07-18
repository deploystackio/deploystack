CREATE TABLE `mcpServerInstallations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`server_id` text NOT NULL,
	`user_id` text NOT NULL,
	`installation_name` text NOT NULL,
	`installation_type` text DEFAULT 'local' NOT NULL,
	`user_environment_variables` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `mcpServers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mcp_installations_team_name_idx` ON `mcpServerInstallations` (`team_id`,`installation_name`);--> statement-breakpoint
CREATE INDEX `mcp_installations_team_server_idx` ON `mcpServerInstallations` (`team_id`,`server_id`);--> statement-breakpoint
CREATE INDEX `mcp_installations_user_idx` ON `mcpServerInstallations` (`user_id`);