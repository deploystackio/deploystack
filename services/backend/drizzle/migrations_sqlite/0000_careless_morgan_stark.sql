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
CREATE TABLE `dynamic_oauth_clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`grant_types` text NOT NULL,
	`response_types` text NOT NULL,
	`scope` text NOT NULL,
	`token_endpoint_auth_method` text NOT NULL,
	`client_id_issued_at` integer NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dynamic_oauth_clients_expires_at_idx` ON `dynamic_oauth_clients` (`expires_at`);--> statement-breakpoint
CREATE INDEX `dynamic_oauth_clients_created_at_idx` ON `dynamic_oauth_clients` (`created_at`);--> statement-breakpoint
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
	`template_headers` text,
	`team_args_schema` text,
	`team_env_schema` text,
	`team_headers_schema` text,
	`user_args_schema` text,
	`user_env_schema` text,
	`user_headers_schema` text,
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
	`user_args` text,
	`user_env` text,
	`user_headers` text,
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
CREATE INDEX `mcp_user_configs_unique_user_installation` ON `mcpUserConfigurations` (`installation_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scope` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_tokens_token_hash_unique` ON `oauth_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_codes_code_unique` ON `oauth_authorization_codes` (`code`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_hash` text,
	`client_name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`scope` text NOT NULL,
	`team_id` text,
	`created_by_user_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_clients_client_id_unique` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_clients_client_id_idx` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_clients_team_idx` ON `oauth_clients` (`team_id`);--> statement-breakpoint
CREATE INDEX `oauth_clients_active_idx` ON `oauth_clients` (`is_active`);--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`client_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_tokens_token_hash_unique` ON `oauth_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `oauth_team_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scope` text NOT NULL,
	`granted_at` integer NOT NULL,
	`last_used_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_team_consents_user_team_client_idx` ON `oauth_team_consents` (`user_id`,`team_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_team_consents_team_idx` ON `oauth_team_consents` (`team_id`);--> statement-breakpoint
CREATE INDEX `oauth_team_consents_client_idx` ON `oauth_team_consents` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_team_consents_active_idx` ON `oauth_team_consents` (`is_active`);--> statement-breakpoint
CREATE INDEX `oauth_team_consents_unique_user_team_client` ON `oauth_team_consents` (`user_id`,`team_id`,`client_id`);--> statement-breakpoint
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
CREATE TABLE `satelliteCommands` (
	`id` text PRIMARY KEY NOT NULL,
	`satellite_id` text NOT NULL,
	`command_type` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`target_team_id` text,
	`correlation_id` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`error_message` text,
	`result` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `satellite_commands_satellite_status_idx` ON `satelliteCommands` (`satellite_id`,`status`);--> statement-breakpoint
CREATE INDEX `satellite_commands_priority_status_idx` ON `satelliteCommands` (`priority`,`status`);--> statement-breakpoint
CREATE INDEX `satellite_commands_correlation_idx` ON `satelliteCommands` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `satellite_commands_target_team_idx` ON `satelliteCommands` (`target_team_id`);--> statement-breakpoint
CREATE TABLE `satelliteHeartbeats` (
	`id` text PRIMARY KEY NOT NULL,
	`satellite_id` text NOT NULL,
	`status` text NOT NULL,
	`system_metrics` text NOT NULL,
	`process_count` integer DEFAULT 0 NOT NULL,
	`healthy_process_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`response_time_ms` integer,
	`uptime_seconds` integer,
	`version` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `satellite_heartbeats_satellite_timestamp_idx` ON `satelliteHeartbeats` (`satellite_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `satellite_heartbeats_status_idx` ON `satelliteHeartbeats` (`status`);--> statement-breakpoint
CREATE INDEX `satellite_heartbeats_timestamp_idx` ON `satelliteHeartbeats` (`timestamp`);--> statement-breakpoint
CREATE TABLE `satelliteProcesses` (
	`id` text PRIMARY KEY NOT NULL,
	`satellite_id` text NOT NULL,
	`installation_id` text,
	`server_name` text NOT NULL,
	`process_pid` integer,
	`local_port` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`health_status` text DEFAULT 'unknown' NOT NULL,
	`performance_metrics` text,
	`team_id` text NOT NULL,
	`error_message` text,
	`started_at` integer,
	`stopped_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `mcpServerInstallations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `satellite_processes_satellite_status_idx` ON `satelliteProcesses` (`satellite_id`,`status`);--> statement-breakpoint
CREATE INDEX `satellite_processes_team_status_idx` ON `satelliteProcesses` (`team_id`,`status`);--> statement-breakpoint
CREATE INDEX `satellite_processes_health_status_idx` ON `satelliteProcesses` (`health_status`);--> statement-breakpoint
CREATE INDEX `satellite_processes_installation_idx` ON `satelliteProcesses` (`installation_id`);--> statement-breakpoint
CREATE TABLE `satelliteUsageLogs` (
	`id` text PRIMARY KEY NOT NULL,
	`satellite_id` text NOT NULL,
	`user_id` text,
	`team_id` text NOT NULL,
	`process_id` text,
	`request_method` text NOT NULL,
	`request_path` text NOT NULL,
	`tool_name` text,
	`duration_ms` integer,
	`status_code` integer,
	`error_message` text,
	`request_size_bytes` integer,
	`response_size_bytes` integer,
	`user_agent` text,
	`ip_address` text,
	`timestamp` integer NOT NULL,
	`date_partition` text NOT NULL,
	FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`process_id`) REFERENCES `satelliteProcesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `satellite_usage_logs_satellite_timestamp_idx` ON `satelliteUsageLogs` (`satellite_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `satellite_usage_logs_team_timestamp_idx` ON `satelliteUsageLogs` (`team_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `satellite_usage_logs_user_timestamp_idx` ON `satelliteUsageLogs` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `satellite_usage_logs_date_partition_idx` ON `satelliteUsageLogs` (`date_partition`);--> statement-breakpoint
CREATE INDEX `satellite_usage_logs_tool_name_idx` ON `satelliteUsageLogs` (`tool_name`);--> statement-breakpoint
CREATE TABLE `satellites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`satellite_type` text NOT NULL,
	`team_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`capabilities` text NOT NULL,
	`api_key_hash` text NOT NULL,
	`last_heartbeat` integer,
	`system_info` text,
	`config` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `satellites_type_idx` ON `satellites` (`satellite_type`);--> statement-breakpoint
CREATE INDEX `satellites_team_idx` ON `satellites` (`team_id`);--> statement-breakpoint
CREATE INDEX `satellites_status_idx` ON `satellites` (`status`);--> statement-breakpoint
CREATE INDEX `satellites_last_heartbeat_idx` ON `satellites` (`last_heartbeat`);--> statement-breakpoint
CREATE INDEX `satellites_unique_team_name` ON `satellites` (`team_id`,`name`);--> statement-breakpoint
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