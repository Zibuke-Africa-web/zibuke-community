# Payment setup and Sprint D verification

This app uses Peach Hosted Checkout V2 for the initial monthly payment and card
registration, Peach Server-to-Server for recurring debits, and iKhokha Payment API
for annual passes. Merchant approval for these specific products and recurring
tokenization is required. An Orchestration-only Peach account needs a different
adapter; its credentials cannot be substituted here.

## 1. Prepare the database and scheduler

From the repository root, apply `0011_billing_review.sql` before deploying this
release:

```powershell
npm.cmd run db:migrate:remote
```

The main Worker dispatches `0 */4 * * *` to the publisher and `*/15 * * * *` to
billing. Both GET and POST billing requests require `Authorization: Bearer
<CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. Reuse the existing production
`CRON_SECRET`; setting a second secret for billing is unnecessary.

The old `workers/billing` scheduler is superseded. Remove its cron trigger in the
Cloudflare dashboard if that separate Worker was previously deployed. Do not
deploy it alongside the main scheduler. Deterministic charge claims prevent
duplicate debits during overlap, but duplicate schedulers waste query capacity.

## 2. Add the live merchant configuration

Each command below prompts for its value. Paste values only at the prompt, not
into source files, command arguments, screenshots, or logs. `wrangler secret list`
can confirm names without revealing values. `.dev.vars` is local configuration
and does not provision production secrets.

First disable renewal submissions while configuring and testing:

```powershell
npx.cmd wrangler secret put PEACH_RECURRING_ENABLED
```

Enter `false`. Then set the following:

```powershell
npx.cmd wrangler secret put PAYMENTS_APP_URL
npx.cmd wrangler secret put PAYMENTS_MODE
npx.cmd wrangler secret put PEACH_HOSTED_CHECKOUT_URL
npx.cmd wrangler secret put PEACH_ENTITY_ID
npx.cmd wrangler secret put PEACH_CLIENT_ID
npx.cmd wrangler secret put PEACH_CLIENT_SECRET
npx.cmd wrangler secret put PEACH_MERCHANT_ID
npx.cmd wrangler secret put PEACH_ACCESS_TOKEN
npx.cmd wrangler secret put PEACH_WEBHOOK_SECRET
npx.cmd wrangler secret put PEACH_CURRENCIES
npx.cmd wrangler secret put IKHOKHA_APP_KEY
npx.cmd wrangler secret put IKHOKHA_APP_SECRET
npx.cmd wrangler secret put IKHOKHA_ENTITY_ID
npx.cmd wrangler secret put IKHOKHA_CURRENCIES
```

Enter these non-credential values:

| Name | Production value |
| --- | --- |
| `PAYMENTS_APP_URL` | `https://zibukecommunity.co.za` |
| `PAYMENTS_MODE` | `live` |
| `PEACH_HOSTED_CHECKOUT_URL` | `https://secure.peachpayments.com/v2/checkout` |
| `PEACH_CURRENCIES` | `ZAR` |
| `IKHOKHA_CURRENCIES` | `ZAR` |

Use the merchant-issued values for all remaining names. For sandbox testing use
separate test credentials, `PAYMENTS_MODE=sandbox`, and
`PEACH_HOSTED_CHECKOUT_URL=https://testsecure.peachpayments.com/v2/checkout`.
The URL must match the selected mode; arbitrary hosts and mixed environments are
rejected before checkout. Omitting the URL selects the mode's built-in endpoint.

Credential meanings and compatibility aliases:

- `PEACH_ACCESS_TOKEN` is the recurring card API bearer. Existing
  `PEACH_CARD_ACCESS_TOKEN` is also supported and takes precedence when both are
  configured. Keep only one alias, or update both together.
- `PEACH_CLIENT_ID`, `PEACH_CLIENT_SECRET`, and `PEACH_MERCHANT_ID` remain required
  for Hosted V2 OAuth. A card bearer alone cannot create a Hosted V2 checkout.
- `PEACH_WEBHOOK_SECRET` is the Dashboard webhook-header signing secret. Enable
  HMAC signing and use the exact callback URL below.
- Classic Checkout merchants can instead set `PEACH_SECRET_TOKEN` using
  `npx.cmd wrangler secret put PEACH_SECRET_TOKEN`. This verifies the body
  signature over sorted parameter names and values. It is **not** an OAuth secret
  or a recurring card bearer. When `PEACH_WEBHOOK_SECRET` is configured, header
  signing is mandatory; the classic body signature cannot bypass it.
- `IKHOKHA_APP_KEY` maps to the API's `IK-APPID` header. Existing
  `IKHOKHA_APP_ID` is supported and takes precedence when both are present.
- Nonempty Worker bindings, including aliases, take precedence over process
  environment values. Blank bindings allow process fallback. Missing credentials
  log only the configuration name; responses never expose values or provider bodies.

ZAR is the default allowed currency. Prices and currency come from the stored
space, never from browser input. Existing USD plans remain disabled for checkout
unless explicitly allowed after merchant approval; they are never relabeled ZAR.

## 3. Configure and verify callbacks

- Peach: `https://zibukecommunity.co.za/api/webhooks/peach`
- iKhokha: `https://zibukecommunity.co.za/api/webhooks/ikhokha`

Peach payment callbacks are form-urlencoded. Header-signature verification binds
the raw body, webhook URL, delivery ID, and fresh timestamp. Classic body-signed
callbacks use the separate signing-token mechanism above. iKhokha requires
`ik-appid` and `ik-sign`, signing the escaped path plus raw JSON. Configure the
merchant's allowed domains and callback signing before checkout acceptance tests.
Any provider-required Dashboard configuration handshake must be completed during
merchant setup; this route handles payment notifications, not that handshake.

Browser redirects never activate membership or mark an order failed. They display
feedback while `/api/checkout/status` reads only the signed-in member's order.
The UI stops automatic checks after 12 attempts; pending orders older than ten
minutes display operator-review guidance. Signed declines/cancellations mark
pending orders failed; uncertain outcomes remain held. A later authenticated
success can settle a failed order, but a late failure cannot overwrite payment.

## 4. Enable billing after merchant acceptance

On a separate sandbox Worker/database, enable recurring billing with sandbox
credentials and complete initial monthly registration, annual purchase, decline,
cancel, webhook retry, tampered webhook, monthly renewal, and cancellation tests.
Do not set live mode on that sandbox environment. Verify the actual callback
payloads against the merchant's enabled products.

After acceptance, enable the production feature:

```powershell
npx.cmd wrangler secret put PEACH_RECURRING_ENABLED
```

Enter `true`. This permits **real recurring charges** when the main Worker cron
runs in live mode. It also enables new monthly checkouts. Do not enable a second
Peach-managed recurring schedule for these registrations.

Build and deploy this release after the migration and configuration are ready:

```powershell
npm.cmd run build:cloudflare
npm.cmd run deploy:cloudflare
```

## 5. Monitor reconciliation

The schema's paid-through field is `subscriptions.current_period_end`. Billing
selects active Peach **monthly** subscriptions due now and less than 48 hours
overdue, with a token and no review flag. It processes at most ten due renewals
per invocation. Successful settlement advances the stored period by one calendar
month, in the same D1 transaction that records payment and its deduplication receipt.
Month-end dates are clamped to the next month's last day.

An HTTP 400 with a verified card-decline result flags the order and subscription
for review, without extending access. Timeouts and unknown responses remain
pending. Later runs query their merchant reference, never blindly repeat the
debit. Up to two aged uncertain orders are queried per run, oldest checked first.
Missing tokens, unapproved currencies and subscriptions over 48 hours late are
flagged for review rather than charged. No unpaid grace access is granted.

Operator queries (read-only):

```sql
SELECT id, billing_review_reason, current_period_end
FROM subscriptions WHERE billing_review_reason IS NOT NULL;
SELECT id, status, review_reason, created_at, last_checked_at
FROM payment_orders WHERE status = 'pending' OR review_reason IS NOT NULL;
```

Reconcile against the gateway's merchant reference before clearing any flag.
Never delete a renewal order to retry it: its deterministic ID prevents a second
charge for that period. Verified reconciliation clears review flags on settlement.
Initial checkouts without a provider reference need manual merchant reconciliation.

## Verification scope and references

Automated tests use synthetic gateway responses and disposable databases. They
exercise HMAC verification, authorization, atomic rollback, concurrent renewal
claims, HTTP 400 declines, timeout reconciliation, currency validation and member
ownership. They do not certify merchant onboarding or execute live charges.

Provider references: [Hosted V2](https://developer.peachpayments.com/docs/v2-checkout-hosted),
[webhook signatures](https://developer.peachpayments.com/docs/checkout-webhooks),
[classic signing](https://developer.peachpayments.com/docs/checkout-authentication),
[card API and limits](https://developer.peachpayments.com/docs/oppwa-references-api),
[result codes](https://developer.peachpayments.com/docs/dashboard-response-codes),
[iKhokha API](https://developer.ikhokha.com/overview).
