ALTER TABLE `payment_orders` ADD `renewal_subscription_id` text REFERENCES subscriptions(id);--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `period_end` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_pending_unique` ON `payment_orders` (`user_id`,`space_slug`) WHERE "payment_orders"."status"='pending' and "payment_orders"."renewal_subscription_id" is null;