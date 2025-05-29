CREATE TABLE `authKey` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`primary_key` text NOT NULL,
	`hashed_password` text,
	`expires` integer
);
--> statement-breakpoint
CREATE TABLE `authSession` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
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
	`hashed_password` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_username_unique` ON `authUser` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_email_unique` ON `authUser` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `authUser_github_id_unique` ON `authUser` (`github_id`);