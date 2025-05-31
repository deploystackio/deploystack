PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_authUser` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`auth_type` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`github_id` text,
	`hashed_password` text,
	`role_id` text,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_authUser`("id", "username", "email", "auth_type", "first_name", "last_name", "github_id", "hashed_password", "role_id") SELECT "id", "username", "email", "auth_type", "first_name", "last_name", "github_id", "hashed_password", "role_id" FROM `authUser`;--> statement-breakpoint
DROP TABLE `authUser`;--> statement-breakpoint
ALTER TABLE `__new_authUser` RENAME TO `authUser`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_username_unique` ON `authUser` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_email_unique` ON `authUser` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_github_id_unique` ON `authUser` (`github_id`);