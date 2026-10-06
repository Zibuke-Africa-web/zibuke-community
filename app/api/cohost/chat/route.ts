import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { compactCoHostMessages, coHostRetrySeconds, parseCoHostMessages } from "@/lib/cohost";
import { COHOST_SYSTEM_PROMPT } from "@/lib/cohost-knowledge";
import { groqModels, groqReasoningOptions } from "@/lib/groq-config";

// OpenNext does not support Next.js runtime="edge". This runs on Cloudflare Workers
// using only fetch/Web Streams; no Node.js AI SDK or socket dependencies.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

async function readBody(request: Request) {
  if (!request.body) throw new Error("INVALID_BODY");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw new Error("BODY_TOO_LARGE");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    let body: unknown;
    try { body = await readBody(request); }
    catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers }); }
    const messages = parseCoHostMessages(body);
    if (!messages) return Response.json({ error: "INVALID_MESSAGES" }, { status: 400, headers });
    const cf = await getCloudflareContext({ async: true }).catch(() => null);
    const apiKey = cf?.env.GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) return Response.json({ error: "COHOST_NOT_CONFIGURED" }, { status: 503, headers });
    const model = groqModels(cf?.env).text;
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      redirect: "follow",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, ...groqReasoningOptions(model), messages: [{ role: "system", content: COHOST_SYSTEM_PROMPT }, ...compactCoHostMessages(messages)], stream: false, temperature: 0.6, max_completion_tokens: 2048 }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      if (upstream.status === 429) {
        const retryAfter = coHostRetrySeconds(upstream.headers.get("retry-after"));
        return Response.json({ error: "RATE_LIMITED", retryAfter }, {
          status: 429, headers: { ...headers, "Retry-After": String(retryAfter) },
        });
      }
      return Response.json({ error: "COHOST_UNAVAILABLE" }, { status: 502, headers });
    }
    const result = await upstream.json().catch(() => null) as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] } | null;
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || result?.choices?.[0]?.finish_reason !== "stop") {
      return Response.json({ error: "INVALID_PROVIDER_RESPONSE" }, { status: 502, headers });
    }
    return Response.json({ content: content.trim() }, { headers });
  } catch {
    return Response.json({ error: "COHOST_UNAVAILABLE" }, { status: 503, headers });
  }
}
