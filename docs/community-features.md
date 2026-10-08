# Community features and deployment

The existing route group is `app/(platform)`, so the events and directory pages are implemented there. Their public URLs remain `/events` and `/directory`; there are no duplicate route groups.

## Database rollout

Run migrations before deploying the new application:

```sh
npx wrangler d1 migrations apply zibuke-db --local
# Production rollout, after backing up the production database:
npx wrangler d1 migrations apply zibuke-db --remote
npm run build:cloudflare
npm run deploy:cloudflare
```

The deployment workflow applies migrations before uploading the Worker. `0006_cooing_bruce_banner.sql` adds events, RSVPs, directory fields, gamification counters, subscriptions, payment orders and receipts. `0007_lovely_siren.sql` adds renewal tracking and prevents concurrent pending initial checkouts for the same member/space. `0008_paid_spaces.sql` configures the three requested paid spaces. Existing space members do **not** receive a free subscription: the paywall migration requires a valid paid-through subscription for all members.

## Main community feed

Migration `0009_general_feed.sql` provisions General / Welcome for fresh databases, preserving any existing space and its privacy/payment policy. Apply it through the normal migration workflow before rollout.

The authenticated `/feed` reads persisted public, non-paywalled space posts and unscoped posts from the trusted system author. Legacy group posts and unscoped ordinary-user posts are excluded. Daily Sparks already have persisted system posts; they appear once in chronological order with a DailySpark badge. Results are paginated in batches of 30, newest first with ID tie-breaking. Search filters the displayed page.

The composer delegates to the existing space-post publishing implementation, validates content/media, derives authorship from the session, and joins the author to General when necessary. It fails closed if General is missing, private or paid, including a policy change during insertion. Successful posts revalidate `/`, `/feed` and the space. Photo uploads use the existing R2 action; HTTPS media links are also supported. Likes and comments remain unimplemented and are no longer presented as local-only controls.

`/groups` permanently redirects to `/spaces`. Navigation and widgets no longer link to `/messages`; direct visits show a static coming-soon page without reading posts.

## Events and directory data

Events are persisted in D1. There is deliberately no fabricated workshop schedule. Insert real events through an authorized database/admin workflow; timestamps are Unix seconds, rendered in South African Standard Time:

```sql
INSERT INTO events (id, space_id, title, description, host_name, start_time, meet_url, is_virtual)
VALUES ('unique-event-id', NULL, 'Your workshop title', 'Your workshop description',
        'Your host', unixepoch('2026-12-01 16:00:00'), 'https://your-meeting-host.example/room', 1);
-- NULL space_id makes an event community-wide. A space ID applies that space's access rules.
```

RSVP uniqueness is enforced in the database. Server actions verify the current NextAuth session and space entitlement; private events are hidden and paid room URLs are withheld from non-subscribers. Canceling an RSVP only deletes the signed-in member's row.

Directory search and filters run on the server, with 24 results per page. Business fields live on `users` and can be populated through an authorized administration/import workflow. `is_verified_partner` must be approved administratively; the badge also requires a current paid subscription. No client action can self-assign verification. WhatsApp numbers accept international format or a ten-digit South African local number.

Daily activity is recorded on successful sign-in and space posting. The atomic update uses Johannesburg calendar days, gives ten points once on a consecutive day, and resets after a missed day. The leaderboard reads stored counters for five members active within 30 days, rather than aggregating posts. `badge_title` is an optional administrative title.

## Botanist

`components/botanist-widget.tsx` supports file selection, camera capture, thumbnail removal and text-only diagnosis. The API requires a paid GreenSpace entitlement even when called directly. It accepts JSON or multipart input, validates JPEG/PNG/WebP data URIs up to 3 MB, and returns `{ analysis, requiresPhysicalService }`.

As previously approved, the implementation retains the supported vision model configured by `GROQ_VISION_MODEL` (default `qwen/qwen3.8-27b`) rather than reverting to the retired `llama-3.2-11b-vision-preview`. Text uses `GROQ_TEXT_MODEL` (default `openai/gpt-oss-20b`). The model prompt grounds responses in South African horticulture and the trusted Zibuke OnCall URL is appended server-side when physical service is recommended.

All Groq requests use native fetch with `redirect: "follow"`. OpenNext uses its supported default/Node runtime on Workers; no handler declares `runtime = "edge"`.

## Validation

```sh
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build:cloudflare
```

The feature regression suite applies every migration to disposable SQLite using the real Drizzle D1 adapter and checks RSVP ownership, streak idempotency, signatures, paid access, duplicate receipts, cancellation and recurring charge claims. The Groq regression suite also runs the handlers in real workerd with a mocked upstream. Payment provider calls in tests are fixtures; live gateway acceptance must be verified with the merchant sandbox as described in [payments.md](payments.md).
