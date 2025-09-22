CREATE TABLE `satelliteRegistrationTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_type` text NOT NULL,
	`team_id` text,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_by` text NOT NULL,
	`permissions` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`used_at` text,
	`used_by_satellite_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_by_satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `satelliteRegistrationTokens_token_hash_unique` ON `satelliteRegistrationTokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `satelliteRegistrationTokens_token_hash_idx` ON `satelliteRegistrationTokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `satelliteRegistrationTokens_team_scope_idx` ON `satelliteRegistrationTokens` (`team_id`,`token_type`);--> statement-breakpoint
CREATE INDEX `satelliteRegistrationTokens_expiration_idx` ON `satelliteRegistrationTokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `satelliteRegistrationTokens_creator_idx` ON `satelliteRegistrationTokens` (`created_by`);--> statement-breakpoint
CREATE INDEX `satelliteRegistrationTokens_usage_idx` ON `satelliteRegistrationTokens` (`used`,`used_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcpServerInstallations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`server_id` text NOT NULL,
	`created_by` text NOT NULL,
	`installation_name` text NOT NULL,
	`installation_type` text DEFAULT 'global' NOT NULL,
	`team_args` text,
	`team_env` text,
	`team_headers` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `mcpServers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_mcpServerInstallations`("id", "team_id", "server_id", "created_by", "installation_name", "installation_type", "team_args", "team_env", "team_headers", "created_at", "updated_at", "last_used_at") SELECT "id", "team_id", "server_id", "created_by", "installation_name", "installation_type", "team_args", "team_env", "team_headers", "created_at", "updated_at", "last_used_at" FROM `mcpServerInstallations`;--> statement-breakpoint
DROP TABLE `mcpServerInstallations`;--> statement-breakpoint
ALTER TABLE `__new_mcpServerInstallations` RENAME TO `mcpServerInstallations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `mcp_installations_team_name_idx` ON `mcpServerInstallations` (`team_id`,`installation_name`);--> statement-breakpoint
CREATE INDEX `mcp_installations_team_server_idx` ON `mcpServerInstallations` (`team_id`,`server_id`);--> statement-breakpoint
CREATE INDEX `mcp_installations_created_by_idx` ON `mcpServerInstallations` (`created_by`);