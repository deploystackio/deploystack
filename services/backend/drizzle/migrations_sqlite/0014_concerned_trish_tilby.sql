CREATE TABLE `mcpCategories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
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
INSERT INTO `mcpCategories` (`id`, `name`, `description`, `icon`, `sort_order`, `created_at`) 
VALUES ('default-category-id', 'Default', 'Default category', 'Tags', 0, strftime('%s', 'now') * 1000);
