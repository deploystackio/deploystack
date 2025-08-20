CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_name` text NOT NULL,
	`hostname` text,
	`hardware_id` text,
	`os_type` text,
	`os_version` text,
	`arch` text,
	`node_version` text,
	`last_ip` text,
	`user_agent` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_trusted` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`last_activity_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_hardware_id_unique` ON `devices` (`hardware_id`);--> statement-breakpoint
CREATE INDEX `devices_user_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `devices_hardware_id_idx` ON `devices` (`hardware_id`);--> statement-breakpoint
CREATE INDEX `devices_active_idx` ON `devices` (`is_active`);--> statement-breakpoint
CREATE INDEX `devices_last_activity_idx` ON `devices` (`last_activity_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcpUserConfigurations` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`user_args` text,
	`user_env` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`installation_id`) REFERENCES `mcpServerInstallations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mcpUserConfigurations`("id", "installation_id", "user_id", "device_id", "user_args", "user_env", "created_at", "updated_at", "last_used_at") SELECT "id", "installation_id", "user_id", "device_id", "user_args", "user_env", "created_at", "updated_at", "last_used_at" FROM `mcpUserConfigurations`;--> statement-breakpoint
DROP TABLE `mcpUserConfigurations`;--> statement-breakpoint
ALTER TABLE `__new_mcpUserConfigurations` RENAME TO `mcpUserConfigurations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `mcp_user_configs_installation_user_device_idx` ON `mcpUserConfigurations` (`installation_id`,`user_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_device_idx` ON `mcpUserConfigurations` (`device_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_user_idx` ON `mcpUserConfigurations` (`user_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_installation_idx` ON `mcpUserConfigurations` (`installation_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_unique_user_installation_device` ON `mcpUserConfigurations` (`installation_id`,`user_id`,`device_id`);