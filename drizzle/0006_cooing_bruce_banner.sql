CREATE TABLE `event_rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_rsvps_event_user_unique` ON `event_rsvps` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `event_rsvps_user_idx` ON `event_rsvps` (`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`host_name` text NOT NULL,
	`start_time` integer NOT NULL,
	`meet_url` text,
	`is_virtual` integer DEFAULT true NOT NULL,
	`cover_image` text,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_upcoming_idx` ON `events` (`start_time`,`id`);--> statement-breakpoint
CREATE INDEX `events_space_start_idx` ON `events` (`space_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `payment_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`space_slug` text NOT NULL,
	`gateway` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`provider_id` text,
	`checkout_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_slug`) REFERENCES `spaces`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_provider_unique` ON `payment_orders` (`gateway`,`provider_id`);--> statement-breakpoint
CREATE INDEX `payment_orders_user_idx` ON `payment_orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `payment_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`space_slug` text NOT NULL,
	`gateway` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`status` text DEFAULT 'expired' NOT NULL,
	`current_period_end` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`registration_id` text,
	`schedule_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_slug`) REFERENCES `spaces`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_access_idx` ON `subscriptions` (`user_id`,`space_slug`,`status`,`current_period_end`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_schedule_unique` ON `subscriptions` (`schedule_id`);--> statement-breakpoint
ALTER TABLE `spaces` ADD `is_paywalled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `currency` text DEFAULT 'ZAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `monthly_price_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `annual_price_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_verified_partner` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `business_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `business_category` text;--> statement-breakpoint
ALTER TABLE `users` ADD `location_city` text DEFAULT 'Secunda' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `whatsapp_number` text;--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `current_streak` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_active_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `badge_title` text;--> statement-breakpoint
CREATE INDEX `users_directory_city_category_idx` ON `users` (`location_city`,`business_category`,`name`,`id`);--> statement-breakpoint
CREATE INDEX `users_points_idx` ON `users` (`points`,`last_active_at`,`id`);--> statement-breakpoint
CREATE INDEX `users_active_idx` ON `users` (`last_active_at`);