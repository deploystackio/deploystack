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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_globalSettings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`is_encrypted` integer DEFAULT false NOT NULL,
	`group_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `globalSettingGroups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_globalSettings`("key", "value", "description", "is_encrypted", "group_id", "created_at", "updated_at") SELECT "key", "value", "description", "is_encrypted", "category", "created_at", "updated_at" FROM `globalSettings`;--> statement-breakpoint
DROP TABLE `globalSettings`;--> statement-breakpoint
ALTER TABLE `__new_globalSettings` RENAME TO `globalSettings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
