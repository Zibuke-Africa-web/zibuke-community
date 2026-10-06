# GreenSpace Hub Botanist

Visit `/spaces/greenspace-hub`. Sign in with an existing community account to submit a question. Photos are optional JPEG, PNG or WebP files up to 3 MB. Camera capture uses the device's rear camera where supported. Questions/photos go to Groq and are not persisted by this feature.

Set the Worker secret with `npx wrangler secret put GROQ_API_KEY`. Local development can use the same secret through Cloudflare context or `process.env.GROQ_API_KEY`. Never place the key in client code or commit it.

`POST /api/botanist/diagnose` accepts JSON or multipart fields `prompt` (1–4,000 characters) and optional `imageBase64` (a JPEG/PNG/WebP base64 data URI). Multipart uses the same data-URI field, not a binary file part. Success is `{ reply: string, isServiceRecommended: boolean }`. Errors use `{ error: string }` with an appropriate HTTP status.

Approved compatibility updates: Next.js `runtime = "nodejs"` runs on Cloudflare Workers through OpenNext; OpenNext does not support Next.js's deprecated `edge` runtime. Groq retired `llama-3.2-11b-vision-preview`; photos use the documented `qwen/qwen3.8-27b` vision model and text-only requests use `llama-3.1-8b-instant`.

Regional grounding is supplied in the system prompt; this is not a live botanical retrieval database. The model returns a validated service recommendation and diagnostic summary. The server appends the fixed OnCall URL, and the client renders an explicit booking link. Clicking it opens OnCall; this feature does not create a booking or transmit the diagnosis to OnCall automatically.

Run `node --test tests/botanist.test.mjs`, `npx tsc --noEmit`, and ESLint for the changed files. Tests mock Groq and authentication; real model responses require a configured secret and an authenticated session.
