ALTER TABLE "zones" ADD COLUMN "ai_provider" text DEFAULT 'anthropic' NOT NULL;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "ai_base_url" text;