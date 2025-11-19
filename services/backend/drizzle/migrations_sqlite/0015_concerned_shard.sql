ALTER TABLE `mcpServerInstallations` ADD `oauth_state` text;--> statement-breakpoint
ALTER TABLE `mcpServerInstallations` ADD `oauth_code_verifier` text;--> statement-breakpoint
ALTER TABLE `mcpServerInstallations` ADD `oauth_pending` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mcpServerInstallations` ADD `oauth_pending_expires_at` integer;