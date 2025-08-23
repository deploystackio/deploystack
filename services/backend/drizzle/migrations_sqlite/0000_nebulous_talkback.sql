CREATE TABLE `authKey` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`primary_key` text NOT NULL,
	`hashed_password` text,
	`expires` integer,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `authSession` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `authUser` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`auth_type` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`github_id` text,
	`hashed_password` text,
	`role_id` text,
	`email_verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_email_unique` ON `authUser` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_github_id_unique` ON `authUser` (`github_id`);--> statement-breakpoint
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
CREATE TABLE `emailVerificationTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `globalSettingGroups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `globalSettings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text DEFAULT 'string' NOT NULL,
	`description` text,
	`is_encrypted` integer DEFAULT false NOT NULL,
	`group_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `globalSettingGroups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mcpCategories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcpCategories_name_unique` ON `mcpCategories` (`name`);--> statement-breakpoint
CREATE TABLE `mcpServerInstallations` (
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
CREATE INDEX `mcp_installations_team_name_idx` ON `mcpServerInstallations` (`team_id`,`installation_name`);--> statement-breakpoint
CREATE INDEX `mcp_installations_team_server_idx` ON `mcpServerInstallations` (`team_id`,`server_id`);--> statement-breakpoint
CREATE INDEX `mcp_installations_created_by_idx` ON `mcpServerInstallations` (`created_by`);--> statement-breakpoint
CREATE TABLE `mcpServerVersions` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`version` text NOT NULL,
	`git_commit` text,
	`changelog` text,
	`is_latest` integer DEFAULT false NOT NULL,
	`is_stable` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `mcpServers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_server_versions_server_idx` ON `mcpServerVersions` (`server_id`);--> statement-breakpoint
CREATE INDEX `mcp_server_versions_latest_idx` ON `mcpServerVersions` (`is_latest`);--> statement-breakpoint
CREATE TABLE `mcpServers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`long_description` text,
	`github_url` text,
	`git_branch` text DEFAULT 'main',
	`homepage_url` text,
	`language` text NOT NULL,
	`runtime` text NOT NULL,
	`runtime_min_version` text,
	`installation_methods` text NOT NULL,
	`tools` text NOT NULL,
	`resources` text,
	`prompts` text,
	`visibility` text DEFAULT 'team' NOT NULL,
	`owner_team_id` text,
	`created_by` text NOT NULL,
	`author_name` text,
	`author_contact` text,
	`organization` text,
	`license` text,
	`transport_type` text DEFAULT 'stdio' NOT NULL,
	`template_args` text,
	`template_env` text,
	`team_args_schema` text,
	`team_env_schema` text,
	`user_args_schema` text,
	`user_env_schema` text,
	`dependencies` text,
	`category_id` text,
	`tags` text,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`auto_install_new_default_team` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_sync_at` integer,
	FOREIGN KEY (`owner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `mcpCategories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcpServers_slug_unique` ON `mcpServers` (`slug`);--> statement-breakpoint
CREATE INDEX `mcp_servers_visibility_idx` ON `mcpServers` (`visibility`);--> statement-breakpoint
CREATE INDEX `mcp_servers_category_idx` ON `mcpServers` (`category_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_status_idx` ON `mcpServers` (`status`);--> statement-breakpoint
CREATE INDEX `mcp_servers_owner_team_idx` ON `mcpServers` (`owner_team_id`);--> statement-breakpoint
CREATE TABLE `mcpUserConfigurations` (
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
CREATE INDEX `mcp_user_configs_installation_user_device_idx` ON `mcpUserConfigurations` (`installation_id`,`user_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_device_idx` ON `mcpUserConfigurations` (`device_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_user_idx` ON `mcpUserConfigurations` (`user_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_installation_idx` ON `mcpUserConfigurations` (`installation_id`);--> statement-breakpoint
CREATE INDEX `mcp_user_configs_unique_user_installation_device` ON `mcpUserConfigurations` (`installation_id`,`user_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scope` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_tokens_token_hash_unique` ON `oauth_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`state` text NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text NOT NULL,
	`code` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_codes_code_unique` ON `oauth_authorization_codes` (`code`);--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_tokens_token_hash_unique` ON `oauth_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text NOT NULL,
	`is_system_role` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `teamCloudCredentials` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`comment` text,
	`credentials` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teamMemberships` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`owner_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE TABLE `userPreferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`preference_key` text NOT NULL,
	`preference_value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_preferences_user_key_idx` ON `userPreferences` (`user_id`,`preference_key`);--> statement-breakpoint
CREATE INDEX `user_preferences_user_idx` ON `userPreferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_preferences_key_idx` ON `userPreferences` (`preference_key`);--> statement-breakpoint
CREATE INDEX `user_preferences_unique_user_key` ON `userPreferences` (`user_id`,`preference_key`);

-- Insert default roles (permissions will be synced by RoleSyncService on server startup)
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system_role`, `created_at`, `updated_at`) VALUES 
('global_admin', 'Global Administrator', 'Full system access with user management capabilities', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('global_user', 'Global User', 'Standard user with basic profile access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_admin', 'Team Administrator', 'Team management with member and credential access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_user', 'Team User', 'Basic team member with view access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

INSERT INTO `mcpCategories` (`id`, `name`, `description`, `icon`, `sort_order`, `created_at`) 
VALUES ('default-category-id', 'Default', 'Default category', 'Tags', 0, strftime('%s', 'now') * 1000);
