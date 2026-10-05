# Zibuke Co-Host

The platform shell mounts one shared provider and one native modal dialog. Both
desktop and mobile widgets open the same chat with the Open Co-Host button. The
existing Daily Spark conversation link still leads to its space. The drawer supports
complete JSON replies, Stop, Clear Chat, copying replies, Escape, native modal focus containment
and restoration, and reduced-motion preferences. Chat lives only in page memory.

## Configuration

Set `GROQ_API_KEY` in the ignored `.dev.vars` for local development, or use:

```powershell
npx.cmd wrangler secret put GROQ_API_KEY
```

The route reads the Cloudflare secret binding using asynchronous context, falling
back to `process.env.GROQ_API_KEY`. Never put the key in source code or a NEXT_PUBLIC variable. No key is read
from loose text files and no new package is required. Provider quotas and pricing
depend on the Groq account; this implementation does not assume unlimited free use.

`POST /api/cohost/chat` requires an existing authenticated session. It accepts only
alternating user/assistant messages ending with a user message. Client system roles
are rejected. Requests are limited to 64 KiB, 20 messages, 4,000 characters per message
and 16,000 characters of combined history. Replies use `llama-3.1-8b-instant`,
512 output tokens, non-streaming `{ content: string }` responses, and a 60-second timeout, with user cancellation propagated upstream.
Only the last two complete exchanges and the current question are sent to Groq,
within a 6,000-character conversation budget. Older exchanges are dropped as pairs.
Provider HTTP 429 responses forward Retry-After (60 seconds when absent/invalid).
The drawer preserves the draft and disables sending and suggestion chips during
the countdown, including after Clear Chat or closing/reopening the drawer. No
automatic retries consume extra quota. This is a page-session cooldown, not a
global account quota guarantee. Provider rate-limit errors receive a retry notice; credentials and upstream error
bodies are never returned to the client. Configure account quotas or Cloudflare
rate-limiting rules for your traffic requirements; no per-user persistent quota is added.

## Runtime compatibility

The route uses standard fetch and Web Streams on Cloudflare Workers. Next.js
`runtime = 'edge'` is not supported by this project's OpenNext adapter. The route
therefore declares `runtime = 'nodejs'`, as required by OpenNext, while remaining
free of AI SDKs, native sockets, and Node-only AI dependencies.
See https://opennext.js.org/cloudflare/get-started and
https://console.groq.com/docs/text-chat.

## Knowledge and scope

`lib/cohost-knowledge.ts` contains the supplied catalogue, exact prices and payment
providers, existing navigation and capabilities, and Zibuke OnCall information.
GreenSpace Hub, Community Builders Lab, Bulletproof Venture Collective, Botanist AI,
Peach Payments and iKhokha checkout are not implemented by this chat feature. The
prompt identifies those offerings as planned and directs members to currently
available spaces. Update that availability section when the integrations go live.

The assistant can summarize text pasted by the member; it has no live/private-feed
retrieval tools and cannot publish posts, change memberships, book or charge payments.
Responses are rendered as plain text with no HTML interpretation. Chat content is
sent to Groq only when the member sends a message or selects a suggestion.

## Verification

Run `node --test tests/cohost.test.mjs`, lint, and `npm.cmd run build:cloudflare`.
With a configured key, check desktop/mobile opening, keyboard focus and Escape,
complete replies, Stop/Clear during a reply, copy, unauthenticated notices and
provider errors. Mocked tests do not call Groq or consume API quota.
