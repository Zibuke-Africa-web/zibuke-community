CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`email_verified` integer,
	`profile_picture_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`avatar_url` text,
	`bio` text,
	`phone` text,
	`location` text,
	`facebook_url` text,
	`instagram_url` text,
	`tiktok_url` text,
	`website` text,
	`cover_photo_url` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "role", "skills", "avatar_url") SELECT "id", "name", "role", "skills", "avatar_url" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `groups` ADD `privacy` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `visibility` text DEFAULT 'visible' NOT NULL;