# Zibuke Community

Next.js application deployed to Cloudflare Workers using OpenNext. The Worker serves both the application pages and server routes; no separate Cloudflare Pages project is required.

## Production resources

- Worker: `zibuke-community`
- D1 database: `zibuke-db` (binding `DB`)
- R2 cache: `zibuke-community-opennext-cache`
- R2 uploads: `zibuke-media` (binding `ZIBUKE_BUCKET`)
- Intended domain: `zibukecommunity.co.za`

## Local development

```sh
npm ci
npm run typegen
npx wrangler d1 migrations apply zibuke-db --local
npm run dev
```

Keep local credentials in the ignored `.dev.vars` file. Never commit credentials.

## Cloudflare deployment

```sh
npm ci
npm run typegen
npm run build:cloudflare
npm run db:migrate:remote
npm run deploy:cloudflare
```

For Cloudflare Workers Builds, connect `Zibuke-Africa-web/zibuke-community`, branch `main`, with root `/`:

- Build command: `npm run typegen && npm run build:cloudflare`
- Deploy command: `npm run db:migrate:remote && npm run deploy:cloudflare`

Use Linux for automated builds. OpenNext has limited Windows support.

Set `AUTH_SECRET` as a Worker secret. For Facebook login also set `AUTH_FACEBOOK_ID` and `AUTH_FACEBOOK_SECRET` using the Cloudflare dashboard or `wrangler secret put`. Configure this valid OAuth redirect URI in the Meta app:

`https://zibukecommunity.co.za/api/auth/callback/facebook`

Facebook credentials in the local development file are placeholders. A real Meta app and its production login configuration are required for public sign-in. Other providers similarly require their corresponding secrets from `env.d.ts`.

Add `zibukecommunity.co.za` as the Worker's Custom Domain once the Cloudflare zone is active. Its assigned nameservers are `corey.ns.cloudflare.com` and `harleigh.ns.cloudflare.com`.

The production database starts empty; demo seed files are not applied automatically. Admin access requires a signed-in user whose database role is `admin`.

## Social graph migration and Facebook login

The profile extensions, friendship requests, and post media are defined in
`db/schema.ts`. Existing profile fields remain compatible with the current UI.
`socialLinks` stores a JSON object mapping platform names to URLs. A connection
keeps its requester/addressee direction and permits only one row per unordered
user pair, with `pending`, `accepted`, or `blocked` status. Both user foreign keys
cascade on deletion. Query both directions to find a user's accepted friends.

`createdAt` uses Unix seconds. Drizzle sets `updatedAt` on inserts and updates;
older posts have a null `updatedAt`. Raw SQL updates must set it explicitly.
`mediaUrl` stores the URL for an uploaded R2 asset; uploading remains a separate operation.

Migration `drizzle/0002_social_graph.sql` is already generated. Apply it with:

```sh
npx wrangler d1 migrations apply zibuke-db --local
npx wrangler d1 migrations apply zibuke-db --remote
```

For future schema changes, generate SQL before applying it:

```sh
npx drizzle-kit generate --name social_graph
```

Wrangler has no `d1 migrations generate` command. Its `migrations create`
command creates an empty SQL file; use Drizzle generation for this project.

Import `{ FacebookLoginButton }` from `@/components/facebook-login-button`.
It calls `signIn('facebook', { callbackUrl: '/feed' })` and includes pending and
error states. The Facebook provider is already configured in `auth.ts`.
Set real `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`, and `AUTH_SECRET` values
and register `/api/auth/callback/facebook` on the production origin with Meta.
The `/feed` route is the responsive community homepage, and `/` redirects to it.
Its sample posts and friends are labelled as previews. Composer attachments,
posts, likes, and comments are local to the current visit; they do not yet write
to D1 or upload to R2. Desktop sidebars and the center feed scroll independently;
mobile navigation exposes the menu and community widgets in expandable panels.

## Member profiles

All application pages live under `app/(platform)` and share `layout.tsx` and
`platform-shell.tsx`: one header, primary navigation, scrolling content area,
community widgets, and mobile menu. `platform-nav.tsx` is the shared source for
the seven primary links and uses `usePathname()` for active states. The profile
link resolves from the server session; `/profile` redirects to the current user.
Feed and profile pages contain content only. Admin pages retain their access
check and local admin tabs inside the same shell. Events currently has a coming-soon
page; Settings links to the existing profile editors, and Friends lists accepted connections.

`/profile/[id]` loads a member, their accepted connections in either direction,
and their public posts from D1. The post list is paginated, and private or hidden
group posts are excluded. Profile photos fall back to the existing Auth.js image
and avatar fields. Directory names and friend previews link to these pages.

Owners can edit their bio, website, and up to ten social links in `EditProfileModal`.
The Server Action checks the login session, updates only that session's user ID,
validates HTTP(S) URLs, and revalidates the profile after saving. Other signed-in
viewers can send requests or accept incoming requests; existing or blocked
connections cannot be replaced by a new request.

Apply `0002_social_graph.sql` before running the profile against a database that
does not yet have the social graph columns. This feature does not add another migration.

```sh
npx wrangler d1 migrations apply zibuke-db --local
# Before deploying to production:
npx wrangler d1 migrations apply zibuke-db --remote
# Validation and authorization tests (Node 22.6+):
node --experimental-strip-types --test tests/profile-input.test.mjs tests/profile-actions.test.mjs
```

## GitHub Actions automatic deployment

`.github/workflows/deploy.yml` builds and deploys the Worker on pushes to `main`, and supports manual runs from the Actions tab. It installs the locked dependencies, generates types, runs lint, builds OpenNext, applies D1 migrations, and deploys the Worker.

Add a repository Actions secret named `CLOUDFLARE_API_TOKEN`, scoped to the production Cloudflare account, with Workers Scripts Edit, D1 Edit, and Workers R2 Storage Write permissions. The account ID is already set in the workflow. Runtime Facebook credentials and `AUTH_SECRET` stay in the existing Worker's secrets.

Use either this GitHub Actions workflow or Cloudflare Workers Builds as the deployment trigger to avoid deploying every commit twice.
