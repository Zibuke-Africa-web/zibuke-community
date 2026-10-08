ALTER TABLE subscriptions ADD COLUMN billing_review_reason TEXT;
ALTER TABLE payment_orders ADD COLUMN review_reason TEXT;
ALTER TABLE payment_orders ADD COLUMN last_checked_at INTEGER;
CREATE INDEX subscriptions_billing_idx ON subscriptions(gateway,status,billing_cycle,current_period_end);
CREATE INDEX payment_orders_reconcile_idx ON payment_orders(gateway,status,last_checked_at);
