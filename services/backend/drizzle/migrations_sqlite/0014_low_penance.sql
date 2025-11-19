CREATE TABLE `mcpOauthTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `mcpServerInstallations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_oauth_tokens_installation_user_team_idx` ON `mcpOauthTokens` (`installation_id`,`user_id`,`team_id`);--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `requires_oauth` integer DEFAULT false NOT NULL;