import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { parseCoHostMessages } from "@/lib/cohost";
import { COHOST_SYSTEM_PROMPT } from "@/lib/cohost-knowledge";

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
    const { env } = await getCloudflareContext({ async: true });
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
    if (!apiKey) return Response.json({ error: "COHOST_NOT_CONFIGURED" }, { status: 503, headers });
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: COHOST_SYSTEM_PROMPT }, ...messages], stream: true, temperature: 0.6, max_completion_tokens: 900 }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return Response.json({ error: upstream.status === 429 ? "RATE_LIMITED" : "COHOST_UNAVAILABLE" }, { status: upstream.status === 429 ? 429 : 502, headers });
    }
    return new Response(upstream.body, { headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "COHOST_UNAVAILABLE" }, { status: 503, headers });
  }
}
