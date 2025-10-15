CREATE TABLE `mcpClientActivityMetrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`satellite_id` text NOT NULL,
	`auth_identifier` text NOT NULL,
	`bucket_timestamp` integer NOT NULL,
	`bucket_interval` text CHECK(`bucket_interval` IN ('15m', '1h')) NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`tool_call_count` integer DEFAULT 0 NOT NULL,
	`active_client_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_activity_metrics_lookup_idx` ON `mcpClientActivityMetrics` (`user_id`,`team_id`,`bucket_timestamp`,`bucket_interval`);--> statement-breakpoint
CREATE INDEX `mcp_activity_metrics_time_idx` ON `mcpClientActivityMetrics` (`bucket_timestamp`);--> statement-breakpoint
CREATE INDEX `mcp_activity_metrics_satellite_idx` ON `mcpClientActivityMetrics` (`satellite_id`,`bucket_timestamp`);--> statement-breakpoint
CREATE INDEX `mcp_activity_metrics_unique_bucket` ON `mcpClientActivityMetrics` (`user_id`,`team_id`,`satellite_id`,`auth_identifier`,`bucket_timestamp`,`bucket_interval`);