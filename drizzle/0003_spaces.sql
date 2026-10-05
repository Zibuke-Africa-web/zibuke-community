CREATE TABLE `space_members` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `space_members_space_user_unique` ON `space_members` (`space_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `space_members_user_idx` ON `space_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`description` text,
	`icon` text,
	`privacy` text DEFAULT 'public' NOT NULL,
	`is_featured` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "spaces_valid_privacy" CHECK("spaces"."privacy" in ('public', 'members_only', 'private'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spaces_slug_unique` ON `spaces` (`slug`);