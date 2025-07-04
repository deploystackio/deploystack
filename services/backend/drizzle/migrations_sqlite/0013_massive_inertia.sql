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
