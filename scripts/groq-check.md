# Groq deployment health check

Run `node scripts/groq-check.mjs https://your-community-host` (defaults to `http://localhost:3000`). The script exits 0 when the route reports a successful text inference request, otherwise 1. HTTP 200 alone is not success: check `ok`.

`GET /api/groq-check?secret=zibuke-check` reads the key from `getCloudflareContext({ async: true })`, with `process.env.GROQ_API_KEY` fallback when the binding or context is unavailable. Configure production with `npx wrangler secret put GROQ_API_KEY`.

The route uses native fetch to send a five-token text ping to `llama-3.1-8b-instant`. It uses named Next.js and Cloudflare imports, `dynamic = "force-dynamic"`, and the default Next.js runtime compatible with OpenNext. There is no Groq SDK or explicit Edge runtime declaration. Requests have a 30-second timeout and responses are not cached.

This text-only probe replaces the previous models-listing and image-inference checks. It does not verify vision access or prove which key source was used. Success reports the model, a masked key and the presence of the Cloudflare AI binding, as requested. Missing-key diagnostics list binding names; upstream rejection diagnostics include Groq's status and response body. The CLI prints only its pass/fail summary, never these diagnostic details.

- 401: incorrect or missing query gate.
- 200 with `ok: false`: key missing or Groq rejected the request.
- 200 with `ok: true`: Groq accepted the text ping.
- 500: network failure, timeout or other fetch exception.

The fixed query gate is only basic protection; diagnostic responses should be restricted to trusted operators. No deployment or live credential check is performed by the test suite.

Run `node --test tests/groq-check.test.mjs` for mocked route and CLI coverage. Run the script against the updated Worker after deployment to verify the live result.
