ALTER TABLE `mcpServerInstallations` ADD `team_url_query_params` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `template_url_query_params` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `team_url_query_params_schema` text;--> statement-breakpoint
ALTER TABLE `mcpServers` ADD `user_url_query_params_schema` text;--> statement-breakpoint
ALTER TABLE `mcpUserConfigurations` ADD `user_url_query_params` text;