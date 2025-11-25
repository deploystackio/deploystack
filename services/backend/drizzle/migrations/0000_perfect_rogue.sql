CREATE TABLE "authKey" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"primary_key" text NOT NULL,
	"hashed_password" text,
	"expires" integer
);
--> statement-breakpoint
CREATE TABLE "authSession" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authUser" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"auth_type" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"github_id" text,
	"hashed_password" text,
	"role_id" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "authUser_email_unique" UNIQUE("email"),
	CONSTRAINT "authUser_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "dynamic_oauth_clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"redirect_uris" text NOT NULL,
	"grant_types" text NOT NULL,
	"response_types" text NOT NULL,
	"scope" text NOT NULL,
	"token_endpoint_auth_method" text NOT NULL,
	"client_id_issued_at" integer NOT NULL,
	"expires_at" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emailVerificationTokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "globalSettingGroups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "globalSettings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpCategories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcpCategories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mcpClientActivity" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"satellite_id" text NOT NULL,
	"auth_type" text NOT NULL,
	"oauth_client_id" text,
	"api_key_id" text,
	"auth_identifier" text NOT NULL,
	"client_name" text,
	"user_agent" text,
	"ip_address" text,
	"current_session_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"total_tool_calls" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpClientActivityMetrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"satellite_id" text NOT NULL,
	"auth_identifier" text NOT NULL,
	"bucket_timestamp" integer NOT NULL,
	"bucket_interval" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"active_client_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_activity_metrics_unique_bucket" UNIQUE("user_id","team_id","satellite_id","auth_identifier","bucket_timestamp","bucket_interval")
);
--> statement-breakpoint
CREATE TABLE "mcpOauthTokens" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpServerInstallations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"server_id" text NOT NULL,
	"created_by" text NOT NULL,
	"installation_name" text NOT NULL,
	"installation_type" text DEFAULT 'global' NOT NULL,
	"team_args" text,
	"team_env" text,
	"team_headers" text,
	"team_url_query_params" text,
	"oauth_state" text,
	"oauth_code_verifier" text,
	"oauth_pending" boolean DEFAULT false NOT NULL,
	"oauth_pending_expires_at" timestamp with time zone,
	"oauth_client_id" text,
	"oauth_client_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcpServerVersions" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"version" text NOT NULL,
	"git_commit" text,
	"changelog" text,
	"is_latest" boolean DEFAULT false NOT NULL,
	"is_stable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpServers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"official_name" text,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"long_description" text,
	"version" text,
	"repository_url" text,
	"repository_source" text,
	"repository_id" text,
	"repository_subfolder" text,
	"git_branch" text,
	"website_url" text,
	"icon_url" text,
	"language" text NOT NULL,
	"runtime" text NOT NULL,
	"github_account_id" text,
	"github_readme_base64" text,
	"github_stars" integer,
	"packages" text,
	"remotes" text,
	"resources" text,
	"prompts" text,
	"visibility" text DEFAULT 'team' NOT NULL,
	"owner_team_id" text,
	"created_by" text NOT NULL,
	"author_name" text,
	"author_contact" text,
	"organization" text,
	"license" text,
	"transport_type" text DEFAULT 'stdio' NOT NULL,
	"template_args" text,
	"template_env" text,
	"template_headers" text,
	"template_url_query_params" text,
	"team_args_schema" text,
	"team_env_schema" text,
	"team_headers_schema" text,
	"team_url_query_params_schema" text,
	"user_args_schema" text,
	"user_env_schema" text,
	"user_headers_schema" text,
	"user_url_query_params_schema" text,
	"dependencies" text,
	"meta_extensions" text,
	"category_id" text,
	"tags" text,
	"status" text DEFAULT 'active' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"auto_install_new_default_team" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"synced_from_official_registry" boolean DEFAULT false NOT NULL,
	"official_registry_server_id" text,
	"official_registry_version_id" text,
	"official_registry_published_at" timestamp with time zone,
	"official_registry_updated_at" timestamp with time zone,
	"requires_oauth" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	CONSTRAINT "mcpServers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mcpToolMetadata" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"team_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"input_schema" jsonb,
	"token_count" integer DEFAULT 0 NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcpUserConfigurations" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_args" text,
	"user_env" text,
	"user_headers" text,
	"user_url_query_params" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_access_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text NOT NULL,
	"state" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"code" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_authorization_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"client_name" text NOT NULL,
	"redirect_uris" text NOT NULL,
	"scope" text NOT NULL,
	"team_id" text,
	"created_by_user_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"client_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_team_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"team_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passwordResetTokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queueJobBatches" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"total_jobs" integer NOT NULL,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"failed_jobs" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "queueJobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "satelliteCommands" (
	"id" text PRIMARY KEY NOT NULL,
	"satellite_id" text NOT NULL,
	"command_type" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"target_team_id" text,
	"correlation_id" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"result" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satelliteHeartbeats" (
	"id" text PRIMARY KEY NOT NULL,
	"satellite_id" text NOT NULL,
	"status" text NOT NULL,
	"system_metrics" text NOT NULL,
	"process_count" integer DEFAULT 0 NOT NULL,
	"healthy_process_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"response_time_ms" integer,
	"uptime_seconds" integer,
	"version" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satelliteProcesses" (
	"id" text PRIMARY KEY NOT NULL,
	"satellite_id" text NOT NULL,
	"installation_id" text,
	"server_name" text NOT NULL,
	"process_pid" integer,
	"local_port" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"performance_metrics" text,
	"team_id" text NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satelliteRegistrationTokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_type" text NOT NULL,
	"team_id" text,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"created_by" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" text,
	"used_by_satellite_id" text,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "satelliteRegistrationTokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "satelliteUsageLogs" (
	"id" text PRIMARY KEY NOT NULL,
	"satellite_id" text NOT NULL,
	"user_id" text,
	"team_id" text NOT NULL,
	"process_id" text,
	"request_method" text NOT NULL,
	"request_path" text NOT NULL,
	"tool_name" text,
	"duration_ms" integer,
	"status_code" integer,
	"error_message" text,
	"request_size_bytes" integer,
	"response_size_bytes" integer,
	"user_agent" text,
	"ip_address" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"date_partition" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satellites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"satellite_type" text NOT NULL,
	"team_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"capabilities" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"last_heartbeat" timestamp with time zone,
	"system_info" text,
	"config" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamCloudCredentials" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"comment" text,
	"credentials" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamMemberships" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"non_http_mcp_limit" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "userPreferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"preference_key" text NOT NULL,
	"preference_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "authKey" ADD CONSTRAINT "authKey_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authSession" ADD CONSTRAINT "authSession_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authUser" ADD CONSTRAINT "authUser_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emailVerificationTokens" ADD CONSTRAINT "emailVerificationTokens_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "globalSettings" ADD CONSTRAINT "globalSettings_group_id_globalSettingGroups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."globalSettingGroups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivity" ADD CONSTRAINT "mcpClientActivity_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivity" ADD CONSTRAINT "mcpClientActivity_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivity" ADD CONSTRAINT "mcpClientActivity_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivityMetrics" ADD CONSTRAINT "mcpClientActivityMetrics_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivityMetrics" ADD CONSTRAINT "mcpClientActivityMetrics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpClientActivityMetrics" ADD CONSTRAINT "mcpClientActivityMetrics_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpOauthTokens" ADD CONSTRAINT "mcpOauthTokens_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpOauthTokens" ADD CONSTRAINT "mcpOauthTokens_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpOauthTokens" ADD CONSTRAINT "mcpOauthTokens_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD CONSTRAINT "mcpServerInstallations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD CONSTRAINT "mcpServerInstallations_server_id_mcpServers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcpServers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerInstallations" ADD CONSTRAINT "mcpServerInstallations_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServerVersions" ADD CONSTRAINT "mcpServerVersions_server_id_mcpServers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcpServers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServers" ADD CONSTRAINT "mcpServers_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServers" ADD CONSTRAINT "mcpServers_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpServers" ADD CONSTRAINT "mcpServers_category_id_mcpCategories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."mcpCategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpToolMetadata" ADD CONSTRAINT "mcpToolMetadata_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpToolMetadata" ADD CONSTRAINT "mcpToolMetadata_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpUserConfigurations" ADD CONSTRAINT "mcpUserConfigurations_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcpUserConfigurations" ADD CONSTRAINT "mcpUserConfigurations_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_created_by_user_id_authUser_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_team_consents" ADD CONSTRAINT "oauth_team_consents_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_team_consents" ADD CONSTRAINT "oauth_team_consents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passwordResetTokens" ADD CONSTRAINT "passwordResetTokens_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queueJobs" ADD CONSTRAINT "queueJobs_batch_id_queueJobBatches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."queueJobBatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteCommands" ADD CONSTRAINT "satelliteCommands_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteCommands" ADD CONSTRAINT "satelliteCommands_target_team_id_teams_id_fk" FOREIGN KEY ("target_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteCommands" ADD CONSTRAINT "satelliteCommands_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteHeartbeats" ADD CONSTRAINT "satelliteHeartbeats_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteProcesses" ADD CONSTRAINT "satelliteProcesses_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteProcesses" ADD CONSTRAINT "satelliteProcesses_installation_id_mcpServerInstallations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."mcpServerInstallations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteProcesses" ADD CONSTRAINT "satelliteProcesses_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteRegistrationTokens" ADD CONSTRAINT "satelliteRegistrationTokens_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteRegistrationTokens" ADD CONSTRAINT "satelliteRegistrationTokens_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteRegistrationTokens" ADD CONSTRAINT "satelliteRegistrationTokens_used_by_satellite_id_satellites_id_fk" FOREIGN KEY ("used_by_satellite_id") REFERENCES "public"."satellites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteUsageLogs" ADD CONSTRAINT "satelliteUsageLogs_satellite_id_satellites_id_fk" FOREIGN KEY ("satellite_id") REFERENCES "public"."satellites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteUsageLogs" ADD CONSTRAINT "satelliteUsageLogs_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteUsageLogs" ADD CONSTRAINT "satelliteUsageLogs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satelliteUsageLogs" ADD CONSTRAINT "satelliteUsageLogs_process_id_satelliteProcesses_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."satelliteProcesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellites" ADD CONSTRAINT "satellites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellites" ADD CONSTRAINT "satellites_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamCloudCredentials" ADD CONSTRAINT "teamCloudCredentials_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamCloudCredentials" ADD CONSTRAINT "teamCloudCredentials_created_by_authUser_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."authUser"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMemberships" ADD CONSTRAINT "teamMemberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamMemberships" ADD CONSTRAINT "teamMemberships_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_authUser_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userPreferences" ADD CONSTRAINT "userPreferences_user_id_authUser_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."authUser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dynamic_oauth_clients_expires_at_idx" ON "dynamic_oauth_clients" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "dynamic_oauth_clients_created_at_idx" ON "dynamic_oauth_clients" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mcp_activity_user_team_satellite_idx" ON "mcpClientActivity" USING btree ("user_id","team_id","satellite_id");--> statement-breakpoint
CREATE INDEX "mcp_activity_last_activity_idx" ON "mcpClientActivity" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "mcp_activity_team_activity_idx" ON "mcpClientActivity" USING btree ("team_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "mcp_activity_oauth_client_idx" ON "mcpClientActivity" USING btree ("oauth_client_id");--> statement-breakpoint
CREATE INDEX "mcp_activity_api_key_idx" ON "mcpClientActivity" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "mcp_activity_auth_type_idx" ON "mcpClientActivity" USING btree ("auth_type");--> statement-breakpoint
CREATE INDEX "mcp_activity_auth_identifier_idx" ON "mcpClientActivity" USING btree ("auth_identifier");--> statement-breakpoint
CREATE INDEX "mcp_activity_session_idx" ON "mcpClientActivity" USING btree ("current_session_id");--> statement-breakpoint
CREATE INDEX "mcp_activity_unique_user_team_auth_satellite" ON "mcpClientActivity" USING btree ("user_id","team_id","auth_identifier","satellite_id");--> statement-breakpoint
CREATE INDEX "mcp_activity_metrics_lookup_idx" ON "mcpClientActivityMetrics" USING btree ("user_id","team_id","bucket_timestamp","bucket_interval");--> statement-breakpoint
CREATE INDEX "mcp_activity_metrics_time_idx" ON "mcpClientActivityMetrics" USING btree ("bucket_timestamp");--> statement-breakpoint
CREATE INDEX "mcp_activity_metrics_satellite_idx" ON "mcpClientActivityMetrics" USING btree ("satellite_id","bucket_timestamp");--> statement-breakpoint
CREATE INDEX "mcp_oauth_tokens_installation_user_team_idx" ON "mcpOauthTokens" USING btree ("installation_id","user_id","team_id");--> statement-breakpoint
CREATE INDEX "mcp_installations_team_name_idx" ON "mcpServerInstallations" USING btree ("team_id","installation_name");--> statement-breakpoint
CREATE INDEX "mcp_installations_team_server_idx" ON "mcpServerInstallations" USING btree ("team_id","server_id");--> statement-breakpoint
CREATE INDEX "mcp_installations_created_by_idx" ON "mcpServerInstallations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "mcp_server_versions_server_idx" ON "mcpServerVersions" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "mcp_server_versions_latest_idx" ON "mcpServerVersions" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX "mcp_servers_visibility_idx" ON "mcpServers" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "mcp_servers_category_idx" ON "mcpServers" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "mcp_servers_status_idx" ON "mcpServers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mcp_servers_owner_team_idx" ON "mcpServers" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "mcp_servers_official_name_idx" ON "mcpServers" USING btree ("official_name");--> statement-breakpoint
CREATE INDEX "mcp_servers_source_idx" ON "mcpServers" USING btree ("source");--> statement-breakpoint
CREATE INDEX "mcp_servers_synced_flag_idx" ON "mcpServers" USING btree ("synced_from_official_registry");--> statement-breakpoint
CREATE INDEX "mcp_servers_registry_server_id_idx" ON "mcpServers" USING btree ("official_registry_server_id");--> statement-breakpoint
CREATE INDEX "mcp_servers_repository_url_idx" ON "mcpServers" USING btree ("repository_url");--> statement-breakpoint
CREATE INDEX "mcp_tool_metadata_installation_idx" ON "mcpToolMetadata" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "mcp_tool_metadata_team_idx" ON "mcpToolMetadata" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "mcp_tool_metadata_unique_installation_tool" ON "mcpToolMetadata" USING btree ("installation_id","tool_name");--> statement-breakpoint
CREATE INDEX "mcp_user_configs_installation_user_idx" ON "mcpUserConfigurations" USING btree ("installation_id","user_id");--> statement-breakpoint
CREATE INDEX "mcp_user_configs_user_idx" ON "mcpUserConfigurations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mcp_user_configs_installation_idx" ON "mcpUserConfigurations" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "mcp_user_configs_unique_user_installation" ON "mcpUserConfigurations" USING btree ("installation_id","user_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_team_idx" ON "oauth_clients" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_active_idx" ON "oauth_clients" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "oauth_team_consents_user_team_client_idx" ON "oauth_team_consents" USING btree ("user_id","team_id","client_id");--> statement-breakpoint
CREATE INDEX "oauth_team_consents_team_idx" ON "oauth_team_consents" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "oauth_team_consents_client_idx" ON "oauth_team_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_team_consents_active_idx" ON "oauth_team_consents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "oauth_team_consents_unique_user_team_client" ON "oauth_team_consents" USING btree ("user_id","team_id","client_id");--> statement-breakpoint
CREATE INDEX "job_batches_status_idx" ON "queueJobBatches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_batches_created_at_idx" ON "queueJobBatches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_scheduled_idx" ON "queueJobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "queueJobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "queueJobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_batch_id_idx" ON "queueJobs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "satellite_commands_satellite_status_idx" ON "satelliteCommands" USING btree ("satellite_id","status");--> statement-breakpoint
CREATE INDEX "satellite_commands_priority_status_idx" ON "satelliteCommands" USING btree ("priority","status");--> statement-breakpoint
CREATE INDEX "satellite_commands_correlation_idx" ON "satelliteCommands" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "satellite_commands_target_team_idx" ON "satelliteCommands" USING btree ("target_team_id");--> statement-breakpoint
CREATE INDEX "satellite_heartbeats_satellite_timestamp_idx" ON "satelliteHeartbeats" USING btree ("satellite_id","timestamp");--> statement-breakpoint
CREATE INDEX "satellite_heartbeats_status_idx" ON "satelliteHeartbeats" USING btree ("status");--> statement-breakpoint
CREATE INDEX "satellite_heartbeats_timestamp_idx" ON "satelliteHeartbeats" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "satellite_processes_satellite_status_idx" ON "satelliteProcesses" USING btree ("satellite_id","status");--> statement-breakpoint
CREATE INDEX "satellite_processes_team_status_idx" ON "satelliteProcesses" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "satellite_processes_health_status_idx" ON "satelliteProcesses" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "satellite_processes_installation_idx" ON "satelliteProcesses" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "satelliteRegistrationTokens_token_hash_idx" ON "satelliteRegistrationTokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "satelliteRegistrationTokens_team_scope_idx" ON "satelliteRegistrationTokens" USING btree ("team_id","token_type");--> statement-breakpoint
CREATE INDEX "satelliteRegistrationTokens_expiration_idx" ON "satelliteRegistrationTokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "satelliteRegistrationTokens_creator_idx" ON "satelliteRegistrationTokens" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "satelliteRegistrationTokens_usage_idx" ON "satelliteRegistrationTokens" USING btree ("used","used_at");--> statement-breakpoint
CREATE INDEX "satellite_usage_logs_satellite_timestamp_idx" ON "satelliteUsageLogs" USING btree ("satellite_id","timestamp");--> statement-breakpoint
CREATE INDEX "satellite_usage_logs_team_timestamp_idx" ON "satelliteUsageLogs" USING btree ("team_id","timestamp");--> statement-breakpoint
CREATE INDEX "satellite_usage_logs_user_timestamp_idx" ON "satelliteUsageLogs" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "satellite_usage_logs_date_partition_idx" ON "satelliteUsageLogs" USING btree ("date_partition");--> statement-breakpoint
CREATE INDEX "satellite_usage_logs_tool_name_idx" ON "satelliteUsageLogs" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "satellites_type_idx" ON "satellites" USING btree ("satellite_type");--> statement-breakpoint
CREATE INDEX "satellites_team_idx" ON "satellites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "satellites_status_idx" ON "satellites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "satellites_last_heartbeat_idx" ON "satellites" USING btree ("last_heartbeat");--> statement-breakpoint
CREATE INDEX "satellites_unique_team_name" ON "satellites" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "user_preferences_user_key_idx" ON "userPreferences" USING btree ("user_id","preference_key");--> statement-breakpoint
CREATE INDEX "user_preferences_user_idx" ON "userPreferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_key_idx" ON "userPreferences" USING btree ("preference_key");--> statement-breakpoint
CREATE INDEX "user_preferences_unique_user_key" ON "userPreferences" USING btree ("user_id","preference_key");

-- Insert default roles (permissions will be synced by RoleSyncService on server startup)
INSERT INTO roles (id, name, description, permissions, is_system_role, created_at, updated_at) VALUES
('global_admin', 'Global Administrator', 'Full system access with user management capabilities', '[]', TRUE, NOW(), NOW()),
('global_user', 'Global User', 'Standard user with basic profile access', '[]', TRUE, NOW(), NOW()),
('team_admin', 'Team Administrator', 'Team management with member and credential access', '[]', TRUE, NOW(), NOW()),
('team_user', 'Team User', 'Basic team member with view access', '[]', TRUE, NOW(), NOW());

INSERT INTO "mcpCategories" (id, name, description, icon, sort_order, created_at)
VALUES ('default-category-id', 'Default', 'Default category', 'Tags', 0, NOW());