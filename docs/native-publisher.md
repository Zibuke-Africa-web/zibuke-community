# Native Cloudflare news publisher

The main Worker runs `0 */4 * * *` (UTC, every four hours). `worker.ts` preserves
OpenNext's fetch handler and invokes `/api/cron/publisher` within that handler's
request context. RSS fetching, Workers AI and D1 publishing require no n8n service.

The five curated feeds are fetched independently, with a 15-second timeout and
1 MiB limit each. A failed source does not prevent other sources from publishing.
The publisher selects at most two newest unseen articles per invocation. Invalid
or incomplete RSS items are skipped. Only HTTPS article links on the respective
source's domain are accepted. Summaries use the supplied RSS excerpt, not the full
article. AI output is validated; failures leave the article eligible for retry.

The system author is `pulse@zibukecommunity.co.za`. An existing non-system account
with that email is never elevated. Posts target a public, free `general` space,
falling back to the seeded `welcome` space (General / Welcome). Public feed queries
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

Success returns `{ "success": true, "articlesIngested": 2, "postIds": ["…", "…"] }`.
An all-duplicate run returns zero. Invalid authorization returns 401. If all feeds
fail or all attempted summaries fail, the endpoint returns 503. Individual article
failures are logged without content or credentials; partial success returns the
published IDs. Cloudflare's next scheduled run retries unpublished articles.

Verification uses mocked RSS and AI responses with a real local workerd D1 database;
it does not call paid inference or publish to production.
