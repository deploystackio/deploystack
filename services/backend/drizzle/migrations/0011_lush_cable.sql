ALTER TABLE "satellites" ADD COLUMN IF NOT EXISTS "satellite_url" text NOT NULL DEFAULT 'http://unknown';
--> statement-breakpoint
ALTER TABLE "satellites" ALTER COLUMN "satellite_url" DROP DEFAULT;
