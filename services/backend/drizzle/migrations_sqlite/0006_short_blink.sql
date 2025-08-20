CREATE TABLE `mcpUserConfigurations` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`device_name` text,
	`user_args` text,
	`user_env` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`installation_id`) REFERENCES `mcpServerInstallations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_user_configs_installation_user_idx` ON `mcpUserConfigurations` (`installation_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_user_idx` ON `mcpUserConfigurations` (`user_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_installation_idx` ON `mcpUserConfigurations` (`installation_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_unique_user_installation` ON `mcpUserConfigurations` (`installation_id`,`user_id`,`device_name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcpServerInstallations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`server_id` text NOT NULL,
	`created_by` text NOT NULL,
	`installation_name` text NOT NULL,
	`installation_type` text DEFAULT 'local' NOT NULL,
	`team_args` text,
	`team_env` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `mcpServers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_mcpServerInstallations`("id", "team_id", "server_id", "created_by", "installation_name", "installation_type", "team_args", "team_env", "created_at", "updated_at", "last_used_at") SELECT "id", "team_id", "server_id", "created_by", "installation_name", "installation_type", "team_args", "team_env", "created_at", "updated_at", "last_used_at" FROM `mcpServerInstallations`;--> statement-breakpoint
DROP TABLE `mcpServerInstallations`;--> statement-breakpoint
ALTER TABLE `__new_mcpServerInstallations` RENAME TO `mcpServerInstallations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `mcp_installations_team_name_idx` ON `mcpServerInstallations` (`team_id`,`installation_name`);--> statement-breakpoint
CREATE INDEX `mcp_installations_team_server_idx` ON `mcpServerInstallations` (`team_id`,`server_id`);--> statement-breakpoint
CREATE INDEX `mcp_installations_created_by_idx` ON `mcpServerInstallations` (`created_by`);--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `template_args` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `template_env` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `team_args_schema` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `team_env_schema` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `user_args_schema` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `user_env_schema` text;--> statement-breakpoint
ALTER TABLE `mcpServers` DROP COLUMN `environment_variables`;--> statement-breakpoint
ALTER TABLE `mcpServers` DROP COLUMN `args`;