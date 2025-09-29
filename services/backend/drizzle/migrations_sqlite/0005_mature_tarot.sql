CREATE TABLE `queueJobBatches` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`total_jobs` integer NOT NULL,
	`completed_jobs` integer DEFAULT 0 NOT NULL,
	`failed_jobs` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `job_batches_status_idx` ON `queueJobBatches` (`status`);--> statement-breakpoint
CREATE INDEX `job_batches_created_at_idx` ON `queueJobBatches` (`created_at`);--> statement-breakpoint
CREATE TABLE `queueJobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_for` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`batch_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`batch_id`) REFERENCES `queueJobBatches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_status_scheduled_idx` ON `queueJobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `queueJobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_created_at_idx` ON `queueJobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `jobs_batch_id_idx` ON `queueJobs` (`batch_id`);