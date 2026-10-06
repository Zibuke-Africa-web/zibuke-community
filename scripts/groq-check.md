# Groq deployment health check

Run `node scripts/groq-check.mjs https://your-community-host` (defaults to `http://localhost:3000`). The script checks the application's runtime key, not a key on the machine running the script. It exits 0 only when key retrieval, Groq authentication and actual image inference succeed; otherwise it exits 1.

The route is `GET /api/groq-check?secret=zibuke-check`. It tries `await getCloudflareContext({ async: true })` first, then falls back to `process.env.GROQ_API_KEY`, including when Cloudflare context is unavailable. `keySource` identifies which source was used; success using the fallback does not prove a Cloudflare binding exists. Configure production with `npx wrangler secret put GROQ_API_KEY`.

The check authenticates against `/openai/v1/models`, then submits a synthetic PNG to `/openai/v1/chat/completions` using the Botanist's approved vision model, `qwen/qwen3.8-27b`. Each authorized check incurs a small inference request; use manually rather than as a frequent uptime probe. The route does not return the key, key fragments, raw upstream errors, or model output. Responses are not cached.

## Runtime limitation

This route uses `export const runtime = "edge"` as explicitly requested for this task. The installed Next.js 16 documentation deprecates this runtime and the current `@opennextjs/cloudflare` adapter does not support deploying it. For the existing Cloudflare Workers deployment, change this route to `runtime = "nodejs"` (as used by Botanist). The route otherwise uses Web APIs and Cloudflare context, without a Node-only Groq SDK. An Edge-runtime implementation alone is not evidence of a successful OpenNext deployment.

## Access gate

The requested fixed `zibuke-check` query value is a basic access gate, not strong production authentication: it is in source code and query strings can appear in browser history and access logs. For stronger protection put the endpoint behind Cloudflare Access or replace the gate with a randomly generated server-side secret supplied in an authorization header. Do not share URLs containing production secrets.

## Status codes

- 200: key available, authentication and vision inference passed.
- 401: missing or incorrect check query value; Groq is not contacted.
- 503: no API key available.
- 429: Groq rate limit; not evidence of an invalid key.
- 502: Groq authentication/access failure, provider error, or invalid response. `stage` and a sanitized error code identify the failure; `upstreamStatus` is included for HTTP errors.
- 504: request timeout or cancellation.

Run mocked coverage with `node --test tests/groq-check.test.mjs`. A passing mock test does not validate the live Worker secret; use the script against a running compatible deployment for that.
