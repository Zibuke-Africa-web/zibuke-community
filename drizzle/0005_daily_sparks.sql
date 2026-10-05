CREATE TABLE `daily_sparks` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`prompt` text NOT NULL,
	`action_text` text,
	`target_space_slug` text DEFAULT 'welcome' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "daily_sparks_active_boolean" CHECK("daily_sparks"."is_active" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `daily_sparks_created_idx` ON `daily_sparks` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_sparks_one_active` ON `daily_sparks` (`is_active`) WHERE "daily_sparks"."is_active" = 1;