ALTER TABLE `posts` ADD `space_id` text REFERENCES spaces(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `posts_space_created_idx` ON `posts` (`space_id`,`created_at`,`id`);
