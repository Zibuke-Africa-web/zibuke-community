# Daily Spark deployment

The main app uses Workers AI binding `AI` with `@cf/meta/llama-3.1-8b-instruct-fp8`.
The secure GET/POST endpoint is `/api/cron/daily-spark`; it requires exactly
`Authorization: Bearer <CRON_SECRET>`. Missing configuration returns 503 and invalid
tokens return 401. The secret is never embedded in client code or scheduler URLs.

Next.js `runtime = "edge"` is not supported by this OpenNext adapter. This route uses
`runtime = "nodejs"` and is bundled into the Cloudflare Worker with Web APIs and the
native Workers AI binding; no external AI SDK is installed.
See https://opennext.js.org/cloudflare/get-started and
https://developers.cloudflare.com/workers-ai/configuration/bindings/.

## Rollout

1. Review `drizzle/0005_daily_sparks.sql` and all earlier pending migrations. Apply
   locally first with `npx.cmd wrangler d1 migrations apply zibuke-db --local`.
2. Ensure public spaces exist (`db/seed-spaces.sql` is repeatable).
3. Apply reviewed migrations remotely with
   `npx.cmd wrangler d1 migrations apply zibuke-db --remote`.
4. Set a strong random secret using `npx.cmd wrangler secret put CRON_SECRET`.
   For local preview, put it in the ignored `.dev.vars` file. Workers AI calls use
   the configured account and can incur usage charges; tests mock AI entirely.
5. Build/deploy the main application using its existing Cloudflare scripts.
6. Choose an external scheduler issuing authenticated POST requests, or deploy the
   included separate cron Worker:

```powershell
npx.cmd wrangler secret put CRON_SECRET --config workers/daily-spark/wrangler.toml
npx.cmd wrangler deploy --config workers/daily-spark/wrangler.toml
```

Use the same secret in both Workers. The scheduler's service binding calls the main
application and runs at 06:00 UTC / 08:00 Johannesburg daily. A Cron Trigger is not
an HTTP-route scheduler by itself: the included `scheduled()` handler performs the
authenticated request. Deployment/configuration has not been performed automatically.

## Behaviour

- Examines at most 30 public posts in the preceding 48 hours. Private/members-only
  spaces and private/hidden groups are excluded, as are previous system posts.
- Sends only topic counts and public space names to AI, not raw post text or member
  identities. Generated JSON must pass length, destination, and link/contact checks.
- Publishes one spark per Johannesburg calendar day using a deterministic primary key.
  Concurrent requests may invoke AI twice, but the D1 transaction publishes once.
- Spark activation, system-account creation, and main-feed post insertion share one
  atomic D1 batch. Failures preserve the previous active spark. Only one row may be active.
- The system account has no email, OAuth account, or session; it gets no admin privileges.
- `/feed` displays the active Spark above the unchanged existing community posts.
  Desktop/mobile widgets receive the active Spark through the server layout on page
  load/refresh. Historical generated posts remain in D1. Existing in-browser sessions
  do not poll; refresh to see a Spark generated after the page loaded.
- Empty/unavailable tables produce a curated widget fallback, not a fake persisted post.
- Retry failed runs with the same authenticated request; successful same-day repeats
  return `generated: false` without invoking AI again.

Review model output quality after rollout; automated text validation is not a guarantee
of content quality. A failed run returns a generic 503 without exposing secrets or SQL.
