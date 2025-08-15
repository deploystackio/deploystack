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
CREATE INDEX `user_preferences_unique_user_key` ON `userPreferences` (`user_id`,`preference_key`);--> statement-breakpoint