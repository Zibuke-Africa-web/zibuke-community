# Native Cloudflare news publisher

The main Worker runs `0 */4 * * *` (UTC, every four hours). `worker.ts` preserves
OpenNext's fetch handler and invokes `/api/cron/publisher` within that handler's
request context. RSS fetching, Workers AI and D1 publishing require no n8n service.

The five curated feeds are fetched independently, with a 15-second timeout and
1 MiB limit each. A failed source does not prevent other sources from publishing.
The publisher selects at most two newest unseen articles per invocation. Invalid
or incomplete RSS items are skipped. Only HTTPS article links on the respective
source's domain are accepted. Summaries use the supplied RSS excerpt, not the full
article. AI output is validated and bounded by a 45-second timeout. Failures publish a clean RSS excerpt and a discussion question, and are included in diagnostics.

The system author is `pulse@zibukecommunity.co.za`. An existing non-system account
with that email is never elevated. Posts target a public, free `general` space,
falling back to the seeded `welcome` space, then any public free space, then creating General if its slug is available. Restricted spaces are never made public. Public feed queries
already include these posts. Path invalidation refreshes the home and space feeds.

Migration `0010_published_articles.sql` adds a durable source URL receipt. A D1
transaction checks and inserts the post and receipt together, preventing duplicate
publication on concurrent calls. Receipts survive post deletion. Tracking query
parameters and URL fragments are removed; different publisher URLs for the same
story are not semantic duplicates. Existing posts containing the source URL are
also skipped. Treat the receipt table as permanent publication history.

## Activation

1. Apply the migration: `npm run db:migrate:remote`.
2. Ensure the production Worker has `CRON_SECRET` (`npx wrangler secret put CRON_SECRET`).
   Reuse the existing secret if already configured. Do not commit its value.
3. Build and deploy: `npm run build:cloudflare` then `npm run deploy:cloudflare`.
   The existing `AI` and `DB` bindings are required.
4. Check Worker scheduled invocation logs after deployment. Manual triggers publish
   real posts and consume Workers AI capacity. GET and POST accept either
   `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

The response includes `success`, `feedsChecked` (URL, item count, error),
`itemsFound`, `articlesAttempted`, `articlesSaved`, `errors`, and the
backwards-compatible `articlesIngested` / `postIds` fields. An all-duplicate
run succeeds with zero saves. Unusable feeds or fatal database failures return
503 with diagnostics. A missing receipt table explicitly names migration 0010;
the publisher never bypasses durable deduplication. AI fallback can produce a
successful result with warnings in `errors`.

GET and POST bypass the secret only when NODE_ENV is development. Production
always requires authentication. The scheduled handler registers its invocation
with waitUntil and logs the route status and diagnostic response.

## Verification

- `node --test tests/publisher.test.mjs`: isolated workerd D1 regression tests.
- `node scripts/test-publisher-direct.mjs`: real live RSS fetches and publisher
  functions in workerd with a fresh local D1 database, verifying public posts and
  receipts. AI deliberately fails to exercise the excerpt fallback without paid inference.
- Add `--fixtures` to the direct script for offline RSS fixtures.
- `npx tsc --noEmit` and `npm run lint`.

These scripts do not publish to production. Deploy the rebuilt Worker for fixes
to affect scheduled production runs.
