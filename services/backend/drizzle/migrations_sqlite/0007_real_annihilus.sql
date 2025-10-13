CREATE TABLE `mcpClientActivity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`satellite_id` text NOT NULL,
	`auth_type` text NOT NULL,
	`oauth_client_id` text,
	`api_key_id` text,
	`auth_identifier` text NOT NULL,
	`client_name` text,
	`user_agent` text,
	`ip_address` text,
	`current_session_id` text,
	`first_seen_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	`total_requests` integer DEFAULT 0 NOT NULL,
	`total_tool_calls` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_activity_user_team_satellite_idx` ON `mcpClientActivity` (`user_id`,`team_id`,`satellite_id`);--> statement-breakpoint
CREATE INDEX `mcp_activity_last_activity_idx` ON `mcpClientActivity` (`last_activity_at`);--> statement-breakpoint
CREATE INDEX `mcp_activity_team_activity_idx` ON `mcpClientActivity` (`team_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `mcp_activity_oauth_client_idx` ON `mcpClientActivity` (`oauth_client_id`);--> statement-breakpoint
CREATE INDEX `mcp_activity_api_key_idx` ON `mcpClientActivity` (`api_key_id`);--> statement-breakpoint
CREATE INDEX `mcp_activity_auth_type_idx` ON `mcpClientActivity` (`auth_type`);--> statement-breakpoint
CREATE INDEX `mcp_activity_auth_identifier_idx` ON `mcpClientActivity` (`auth_identifier`);--> statement-breakpoint
CREATE INDEX `mcp_activity_session_idx` ON `mcpClientActivity` (`current_session_id`);--> statement-breakpoint
CREATE INDEX `mcp_activity_unique_user_team_auth_satellite` ON `mcpClientActivity` (`user_id`,`team_id`,`auth_identifier`,`satellite_id`);