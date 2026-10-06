# Membership payments

## Merchant setup required

This integration targets **Peach Hosted Checkout V2 (classic)** for the first card payment and registration, and **Peach Server-to-Server card payments** for subsequent monthly payments. These products require merchant enablement and tokenization/recurring permission. Peach recommends Orchestration for new integrations; an Orchestration-only merchant account needs a different adapter. Confirm the enabled product before configuring credentials.

Primary references: [Peach Hosted V2](https://developer.peachpayments.com/docs/v2-checkout-hosted), [Peach webhook authentication](https://developer.peachpayments.com/docs/checkout-webhooks), [Peach card API](https://developer.peachpayments.com/docs/oppwa-references-api), [iKhokha Payment API](https://developer.ikhokha.com/overview).

The app preserves ZAR and USD prices exactly. **USD checkout is disabled by default.** Set the allowed-currency lists to `ZAR,USD` only after each provider confirms that the merchant account and payment product support USD. The code never silently converts dollars to rand.

## Configuration

Use Worker secrets for credentials (`npx wrangler secret put NAME`) and deployment variables for nonsecret configuration. Do not place credentials in tracked files. Values are read from asynchronous Cloudflare context, with `process.env` fallback for local development.

| Name | Purpose |
| --- | --- |
| `PAYMENTS_APP_URL` | Exact HTTPS application origin, e.g. `https://zibukecommunity.co.za`; no path/query |
| `PAYMENTS_MODE` | `live` for production; otherwise Peach sandbox and iKhokha test mode |
| `PEACH_CLIENT_ID`, `PEACH_CLIENT_SECRET`, `PEACH_MERCHANT_ID` | Hosted Checkout dashboard OAuth credentials |
| `PEACH_ENTITY_ID` | Enabled Checkout/card entity ID |
| `PEACH_WEBHOOK_SECRET` | Secret assigned when enabling webhook HMAC signing |
| `PEACH_CARD_ACCESS_TOKEN` | Server-to-Server recurring card bearer token |
| `PEACH_CURRENCIES` | Comma-separated supported currencies; defaults to `ZAR` |
| `PEACH_RECURRING_ENABLED` | Set to `true` only when recurring permissions and billing scheduler are ready |
| `IKHOKHA_APP_ID`, `IKHOKHA_APP_SECRET`, `IKHOKHA_ENTITY_ID` | Payment API merchant credentials |
| `IKHOKHA_CURRENCIES` | Comma-separated supported currencies; defaults to `ZAR` |
| `CRON_SECRET` | Long random secret, shared with the billing scheduler |

Configure signed callbacks at `/api/webhooks/peach` and `/api/webhooks/ikhokha`. Peach must use form-urlencoded payment notifications with its documented `x-webhook-timestamp`, `x-webhook-id` and `x-webhook-signature` HMAC headers; unsigned notifications are rejected. Its configured webhook URL must exactly match `PAYMENTS_APP_URL` plus the route, because that URL is part of the signature. If merchant onboarding requires a separate webhook configuration handshake, complete that provider setup before sending payment notifications.

iKhokha callbacks must carry `ik-appid` and `ik-sign`; verification signs the escaped callback path plus the unmodified raw JSON body. Register the callback path exactly as shown. Confirm test-mode availability with your iKhokha account before sandbox acceptance testing. Live credentials must not be used for a dry run.

## Recurring scheduler

Checkout creates a recurring card registration; this application schedules the subsequent monthly debits. It does **not** create a second Peach-managed schedule. Do not enable an additional provider-managed schedule for these registrations.

`workers/billing/worker.ts` invokes the billing route using a service binding every 15 minutes. Configure the identical `CRON_SECRET` on both Workers, then deploy the scheduler when ready to enable billing:

```sh
npx wrangler secret put CRON_SECRET
npx wrangler secret put CRON_SECRET --config workers/billing/wrangler.toml
npx wrangler deploy --config workers/billing/wrangler.toml
```

Deploying this scheduler enables future real charges when `PAYMENTS_MODE=live` and recurring billing is enabled. The main application deployment does not automatically deploy it.

Each monthly period receives a deterministic payment reference and an atomic database claim. Concurrent scheduler runs cannot submit the same period twice. Timeouts remain pending; later runs query Peach by merchant reference instead of blindly resubmitting. Canceled subscriptions stop future claims and retain access through the paid-through date. A charge already submitted can still settle after cancellation.

The scheduler processes ten due subscriptions and ten uncertain payments per run. Due subscriptions more than 48 hours overdue require operator reconciliation rather than surprise catch-up billing. Monitor `/api/cron/billing` errors and pending orders; size the scheduler for the membership volume before rollout. Declined or ambiguous renewals do not grant access or automatically retry a debit. Reconcile them before arranging another payment.

## Settlement and operational checks

Prices, user IDs, currencies and space selection are fixed server-side. Return URLs only display pending state; they never activate access. Signed webhook identity, order reference, amount/currency where supplied, and provider references are validated before D1's transactional batch records the receipt and subscription. Duplicate deliveries never extend a pass. Annual access lasts 365 days. Refund/reversal notifications revoke Peach grants; iKhokha refunds require operator reconciliation because this adapter handles its documented SUCCESS/FAILURE payment callback.

An initial checkout with an unknown outcome remains pending and blocks a second initial checkout for the same member/space. Do not delete or mark these orders failed merely because a browser closed. Reconcile the provider transaction first. A signed terminal iKhokha FAILURE releases that hold. Initial Peach failures and missing recurring registration IDs require merchant-side reconciliation.

Before production acceptance, use provider test credentials to complete one approved and one declined checkout, a signed webhook retry, tampered signature rejection, annual activation, one monthly renewal and cancellation. Verify the actual callback fields and HMAC against your enabled products. Test both currencies only where approved. No live checkout, charge, scheduler deployment or merchant verification was performed as part of the local implementation.
