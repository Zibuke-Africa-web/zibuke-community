# Automated Pulse posts (n8n)

`POST /api/internal/bot-post` accepts JSON using either `Authorization: Bearer <BOT_POST_SECRET>` or `x-bot-secret: <BOT_POST_SECRET>`. Configure the secret in the deployed Worker with `npx wrangler secret put BOT_POST_SECRET`, and store the same value in an n8n credential. Locally use the ignored `.dev.vars`. The route reads `process.env.BOT_POST_SECRET`; use the existing Node-compatible OpenNext Worker configuration. No secret has been generated or deployed by Sprint C.

```json
{
  "content": "A new community update with at least ten characters.",
  "title": "Today's Pulse",
  "category": "Tech",
  "sourceUrl": "https://example.com/article",
  "spaceSlug": "general",
  "authorName": "Zibuke Pulse",
  "authorAvatar": "https://example.com/bot.svg"
}
```

Only `content` is required (10–5,000 trimmed characters). The combined headline, category, content and source attribution must fit 5,000 characters. Titles allow 200 characters, categories 80, author names 100, and URLs 2,048. Request bodies are capped at 64 KiB. URLs must use HTTPS without embedded credentials. Hosted SVG avatar URLs are allowed; inline SVG and data URLs are rejected.

`general` (including an omitted slug) maps to the existing `welcome` space. Other slugs resolve exactly. Only public, non-paywalled spaces accept this public-feed pipeline; missing or restricted spaces return 404. General is provisioned by migration 0009 from Sprint B.

The first request provisions the system author `pulse@zibukecommunity.co.za`, with role `system` and a deterministic ID. A matching ordinary account or ambiguous identity returns 409 rather than granting privileges. Optional author fields configure the shared bot profile, so changes also affect the attribution displayed on its older posts. No user session or bot space-membership row is needed. Bot posts appear through the existing public-space feed query; title/category/source are stored as plain text with a `Source: https://...` attribution line.

Responses: 201 `{ "success": true, "postId": "..." }`; 401 missing/invalid/unconfigured secret; 400 invalid payload; 415 non-JSON; 404 unavailable space; 409 identity collision; 503 database failure. Every non-POST method returns 405 with `Allow: POST`. Successful writes revalidate `/`, `/feed`, `/spaces` and the target space.

Each accepted request creates one post. Automatic n8n retries after an ambiguous network failure can create duplicates; this endpoint does not provide an idempotency key.

## Directory locations

The directory uses the viewer's database profile, preferring the first comma-separated city in `location` (the profile setup field), then `locationCity`. A legacy default of Secunda with no explicit `location` is treated as unknown; members in Secunda can confirm it through profile setup. No existing profile records are rewritten.

All locations is the default. A saved city adds a local quick filter. Province filters match explicitly stored province names or the city-hub aliases in `lib/directory.ts`; these are bounded aliases, not geocoding. Unmapped cities still match exact city searches through `?city=...`, or their province when supplied in the saved location, for example `Small Town, Gauteng`. Search/category/location filters are parameterized D1 queries, and changing a filter resets pagination. System bot profiles are excluded from member discovery.
