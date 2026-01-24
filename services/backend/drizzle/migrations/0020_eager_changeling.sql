ALTER TABLE "deploymentCredentials" ALTER COLUMN "access_token_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deploymentCredentials" ADD COLUMN "auth_type" text DEFAULT 'oauth' NOT NULL;--> statement-breakpoint
ALTER TABLE "deploymentCredentials" ADD COLUMN "installation_id" text;--> statement-breakpoint
ALTER TABLE "deploymentCredentials" ADD COLUMN "account_login" text;--> statement-breakpoint
ALTER TABLE "deploymentCredentials" ADD COLUMN "account_id" text;