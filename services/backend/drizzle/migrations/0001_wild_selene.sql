ALTER TABLE "authKey" ALTER COLUMN "expires" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "authSession" ALTER COLUMN "expires_at" SET DATA TYPE bigint;