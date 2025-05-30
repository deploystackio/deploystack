PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "created_at", "updated_at") SELECT "id", "email", "name", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `__new_authKey` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`primary_key` text NOT NULL,
	`hashed_password` text,
	`expires` integer,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_authKey`("id", "user_id", "primary_key", "hashed_password", "expires") SELECT "id", "user_id", "primary_key", "hashed_password", "expires" FROM `authKey`;--> statement-breakpoint
DROP TABLE `authKey`;--> statement-breakpoint
ALTER TABLE `__new_authKey` RENAME TO `authKey`;--> statement-breakpoint
CREATE TABLE `__new_authSession` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `authUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_authSession`("id", "user_id", "expires_at") SELECT "id", "user_id", "expires_at" FROM `authSession`;--> statement-breakpoint
DROP TABLE `authSession`;--> statement-breakpoint
ALTER TABLE `__new_authSession` RENAME TO `authSession`;