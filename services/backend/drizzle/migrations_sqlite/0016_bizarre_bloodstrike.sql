PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcpServers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`official_name` text,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`long_description` text,
	`version` text,
	`repository_url` text,
	`repository_source` text,
	`repository_id` text,
	`repository_subfolder` text,
	`git_branch` text,
	`website_url` text,
	`language` text NOT NULL,
	`runtime` text NOT NULL,
	`github_account_id` text,
	`github_readme_base64` text,
	`github_stars` integer,
	`packages` text,
	`remotes` text,
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
	`template_url_query_params` text,
	`team_args_schema` text,
	`team_env_schema` text,
	`team_headers_schema` text,
	`team_url_query_params_schema` text,
	`user_args_schema` text,
	`user_env_schema` text,
	`user_headers_schema` text,
	`user_url_query_params_schema` text,
	`dependencies` text,
	`meta_extensions` text,
	`category_id` text,
	`tags` text,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`auto_install_new_default_team` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`synced_from_official_registry` integer DEFAULT false NOT NULL,
	`official_registry_server_id` text,
	`official_registry_version_id` text,
	`official_registry_published_at` integer,
	`official_registry_updated_at` integer,
	`requires_oauth` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_sync_at` integer,
	FOREIGN KEY (`owner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `mcpCategories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_mcpServers`("id", "name", "official_name", "slug", "description", "long_description", "version", "repository_url", "repository_source", "repository_id", "repository_subfolder", "git_branch", "website_url", "language", "runtime", "github_account_id", "github_readme_base64", "github_stars", "packages", "remotes", "resources", "prompts", "visibility", "owner_team_id", "created_by", "author_name", "author_contact", "organization", "license", "transport_type", "template_args", "template_env", "template_headers", "template_url_query_params", "team_args_schema", "team_env_schema", "team_headers_schema", "team_url_query_params_schema", "user_args_schema", "user_env_schema", "user_headers_schema", "user_url_query_params_schema", "dependencies", "meta_extensions", "category_id", "tags", "status", "featured", "auto_install_new_default_team", "source", "synced_from_official_registry", "official_registry_server_id", "official_registry_version_id", "official_registry_published_at", "official_registry_updated_at", "requires_oauth", "created_at", "updated_at", "last_sync_at") SELECT "id", "name", "official_name", "slug", "description", "long_description", "version", "repository_url", "repository_source", "repository_id", "repository_subfolder", "git_branch", "website_url", "language", "runtime", "github_account_id", "github_readme_base64", "github_stars", "packages", "remotes", "resources", "prompts", "visibility", "owner_team_id", "created_by", "author_name", "author_contact", "organization", "license", "transport_type", "template_args", "template_env", "template_headers", "template_url_query_params", "team_args_schema", "team_env_schema", "team_headers_schema", "team_url_query_params_schema", "user_args_schema", "user_env_schema", "user_headers_schema", "user_url_query_params_schema", "dependencies", "meta_extensions", "category_id", "tags", "status", "featured", "auto_install_new_default_team", "source", "synced_from_official_registry", "official_registry_server_id", "official_registry_version_id", "official_registry_published_at", "official_registry_updated_at", "requires_oauth", "created_at", "updated_at", "last_sync_at" FROM `mcpServers`;--> statement-breakpoint
DROP TABLE `mcpServers`;--> statement-breakpoint
ALTER TABLE `__new_mcpServers` RENAME TO `mcpServers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `mcpServers_slug_unique` ON `mcpServers` (`slug`);--> statement-breakpoint
CREATE INDEX `mcp_servers_visibility_idx` ON `mcpServers` (`visibility`);--> statement-breakpoint
CREATE INDEX `mcp_servers_category_idx` ON `mcpServers` (`category_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_status_idx` ON `mcpServers` (`status`);--> statement-breakpoint
CREATE INDEX `mcp_servers_owner_team_idx` ON `mcpServers` (`owner_team_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_official_name_idx` ON `mcpServers` (`official_name`);--> statement-breakpoint
CREATE INDEX `mcp_servers_source_idx` ON `mcpServers` (`source`);--> statement-breakpoint
CREATE INDEX `mcp_servers_synced_flag_idx` ON `mcpServers` (`synced_from_official_registry`);--> statement-breakpoint
CREATE INDEX `mcp_servers_registry_server_id_idx` ON `mcpServers` (`official_registry_server_id`);--> statement-breakpoint
CREATE INDEX `mcp_servers_repository_url_idx` ON `mcpServers` (`repository_url`);