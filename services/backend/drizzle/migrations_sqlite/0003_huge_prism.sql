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
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);
--> statement-breakpoint
ALTER TABLE `authUser` ADD `role_id` text REFERENCES roles(id);
--> statement-breakpoint

-- Insert default roles (permissions will be synced by RoleSyncService on server startup)
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system_role`, `created_at`, `updated_at`) VALUES 
('global_admin', 'Global Administrator', 'Full system access with user management capabilities', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('global_user', 'Global User', 'Standard user with basic profile access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_admin', 'Team Administrator', 'Team management with member and credential access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('team_user', 'Team User', 'Basic team member with view access', '[]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
--> statement-breakpoint

-- Update existing users to have global_user role (all users since role_id starts as NULL)
UPDATE `authUser` SET `role_id` = 'global_user';
--> statement-breakpoint

-- Make the first user (by creation order) a global admin
UPDATE `authUser` 
SET `role_id` = 'global_admin' 
WHERE `id` = (
    SELECT `id` FROM `authUser` 
    ORDER BY `id` ASC 
    LIMIT 1
);
