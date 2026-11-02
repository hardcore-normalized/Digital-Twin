ALTER TABLE "zones" ADD COLUMN "sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "sync_time" text DEFAULT '14:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "sync_timezone" text DEFAULT 'UTC' NOT NULL;