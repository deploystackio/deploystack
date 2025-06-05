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

-- Insert default roles
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system_role`, `created_at`, `updated_at`) VALUES 
('global_admin', 'Global Administrator', 'Full system access with user management capabilities', '["users.list","users.view","users.edit","users.delete","users.create","roles.manage","system.admin","settings.view","settings.edit","settings.delete","teams.create","teams.view","teams.edit","teams.delete","teams.manage","team.members.view","team.members.manage"]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('global_user', 'Global User', 'Standard user with basic profile access', '["profile.view","profile.edit","teams.create","teams.view","teams.edit","teams.delete","team.members.view"]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
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
