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
CREATE INDEX `mcp_installations_user_idx` ON `mcpServerInstallations` (`user_id`);--> statement-breakpoint
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
	`default_config` text,
	`environment_variables` text,
	`dependencies` text,
	`category_id` text,
	`tags` text,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
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

-- Insert default roles (permissions will be synced by RoleSyncService on server startup)
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system_role`, `created_at`, `updated_at`) VALUES 
('global_admin', 'Global Administrator', 'Full system access with user management capabilities', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('global_user', 'Global User', 'Standard user with basic profile access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_admin', 'Team Administrator', 'Team management with member and credential access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_user', 'Team User', 'Basic team member with view access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

INSERT INTO `mcpCategories` (`id`, `name`, `description`, `icon`, `sort_order`, `created_at`) 
VALUES ('default-category-id', 'Default', 'Default category', 'Tags', 0, strftime('%s', 'now') * 1000);
