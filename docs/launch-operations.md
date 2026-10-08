# Launch operations and smoke checks

## Operator dashboard

Open `/health` as an administrator. The page, its JSON endpoint
`GET /api/admin/health`, and manual-run endpoint independently verify the signed-in
user against the current D1 `users.role`. A stale session cannot retain admin
access after that database role is revoked. Guests receive 401 on the API;
non-admin members receive 403. Browser pages redirect to login or the directory.

The dashboard reports:

- A real D1 `SELECT 1` connectivity check.
- R2 media and Workers AI binding presence, without writes or paid inference.
- The latest published-article timestamp and count of active subscriptions.
- Last recorded publisher/billing execution, HTTP status, and outcome, including
  disabled billing runs. Expected schedules are shown separately from execution
  history; the dashboard does not query Cloudflare's control-plane trigger API.
- Presence of payment credentials after aliases and process fallback resolution.
  Only names and booleans leave the server. Presence is not merchant acceptance.

Manual controls POST to `/api/admin/health/run`. The endpoint requires admin
authorization and a same-origin request. It accepts only `publisher` or `billing`
and uses the Worker self-service binding with the server's cron secret. No cron
secret is sent to browser JavaScript. Publishing creates real public posts.
Billing may charge due subscriptions if recurring billing is enabled; the panel
shows that state immediately above the controls. With billing disabled, the check
records a disabled run without submitting charges.

## Deployment

Apply `0012_service_runs.sql` before deploying this release:

```powershell
npm.cmd run db:migrate:remote
npm.cmd run build:cloudflare
npm.cmd run deploy:cloudflare
```

`service_runs` retains one latest completed invocation per service. It contains no
credentials, provider response bodies, member identifiers, or card information.
Concurrent completions cannot overwrite a more recently started invocation with
an older one. A history-write failure is logged safely and does not alter a
payment or publisher result. Existing history cannot be reconstructed: “Not
recorded yet” is expected until the first authenticated invocation after deployment.

Recurring billing remains controlled by `PEACH_RECURRING_ENABLED`; this sprint
does not enable it. Use [payments-setup.md](payments-setup.md) for merchant setup.

## Recovery and checkout screens

Platform error/not-found boundaries retain the platform layout. Root-level
fallbacks provide a minimal branded screen even if a containing layout fails.
No raw exception messages are displayed. Retry controls use this installed Next
version's `retry` API. Every fallback provides a route back to `/feed`.

New checkouts return to `/checkout/success` or `/checkout/cancelled`. The route
name is not evidence of payment: confirmation comes only from the signed-in
member's stored order. Unconfirmed payments remain clearly identified, with
bounded confirmation checks and return links. Browser return parameters cannot
activate a membership or expose another member's order.

## Launch smoke suite

```powershell
node --test tests/launch-smoke.test.mjs
node --test tests/*.test.mjs
npx.cmd tsc --noEmit --incremental false
npm.cmd run lint
```

The launch suite drives HTTP requests through actual application handlers and
rendered components in a real local workerd runtime with a disposable D1 database:

1. Public Spaces versus authenticated platform routing and feed empty state.
2. Directory location-pill filtering and reset links against seeded members.
3. Pulse post insertion, repeated-RSS deduplication, feed rendering and run history.
4. Webhook HMAC rejection, idempotent settlement, owned checkout results and
   authenticated disabled billing.
5. Admin/member/guest health access, role revocation, credential non-disclosure,
   and same-origin manual controls using internal authorization.

External gateway responses, news/AI data, and authenticated identity are fixtures;
the suite does not open a browser, complete OAuth with real providers, or submit
live payments. Existing auth tests cover the Auth.js boundary separately. Before
public launch, complete a real browser sign-in, mobile navigation check, and
merchant sandbox checkout/callback test with the configured accounts. Automated
smoke success does not replace those external acceptance checks.
