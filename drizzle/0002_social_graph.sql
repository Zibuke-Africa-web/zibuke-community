CREATE TABLE `connections` (
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`requester_id`, `addressee_id`),
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "connections_no_self" CHECK("connections"."requester_id" <> "connections"."addressee_id"),
	CONSTRAINT "connections_valid_status" CHECK("connections"."status" in ('pending', 'accepted', 'blocked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_pair_unique` ON `connections` (min("requester_id", "addressee_id"), max("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX `connections_incoming_status_idx` ON `connections` (`addressee_id`,`status`);--> statement-breakpoint
ALTER TABLE `posts` ADD `media_url` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `website_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `employment_status` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_photo_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `social_links` text DEFAULT '{}' NOT NULL;
