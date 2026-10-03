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

## GitHub Actions automatic deployment

`.github/workflows/deploy.yml` builds and deploys the Worker on pushes to `main`, and supports manual runs from the Actions tab. It installs the locked dependencies, generates types, runs lint, builds OpenNext, applies D1 migrations, and deploys the Worker.

Add a repository Actions secret named `CLOUDFLARE_API_TOKEN`, scoped to the production Cloudflare account, with Workers Scripts Edit, D1 Edit, and Workers R2 Storage Write permissions. The account ID is already set in the workflow. Runtime Facebook credentials and `AUTH_SECRET` stay in the existing Worker's secrets.

Use either this GitHub Actions workflow or Cloudflare Workers Builds as the deployment trigger to avoid deploying every commit twice.
