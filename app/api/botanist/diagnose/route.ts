import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { BOTANIST_SYSTEM_PROMPT, parseBotanistInput, parseBotanistReply } from "@/lib/botanist";

// OpenNext runs this on Cloudflare Workers; Next.js's edge runtime is unsupported.
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 4 * 1024 * 1024 + 32768;

async function readInput(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
    throw new Error("Use JSON or multipart form data.");
  }
  if (!request.body) throw new Error("Enter a plant question.");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const body = new Response(new Blob(chunks), { headers: { "Content-Type": type } });
  if (type.startsWith("application/json")) return parseBotanistInput(await body.json());
  const form = await body.formData();
  return parseBotanistInput({ prompt: form.get("prompt"), imageBase64: form.get("imageBase64") ?? undefined });
}

export async function POST(request: Request) {
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("This request is not allowed.", 403);
  try {
    const session = await auth();
    if (!session?.user?.id) return fail("Sign in to use the Botanist AI Agent.", 401);
    let input: ReturnType<typeof parseBotanistInput>;
    try { input = await readInput(request); }
    catch (error) {
      if (error instanceof Error && error.message === "BODY_TOO_LARGE") return fail("Choose a photo under 3 MB.", 413);
      return fail("Enter a question of 1–4,000 characters and, optionally, a valid JPEG, PNG or WebP data URI under 3 MB.", 400);
    }
    const cf = await getCloudflareContext({ async: true }).catch(() => null);
    const apiKey = cf?.env.GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) return fail("The Botanist is not configured yet. Please try again later.", 503);
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.imageBase64 ? "qwen/qwen3.8-27b" : "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: BOTANIST_SYSTEM_PROMPT },
          { role: "user", content: input.imageBase64 ? [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: input.imageBase64 } },
          ] : input.prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, max_completion_tokens: 2048, stream: false,
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      if (upstream.status === 429) return Response.json({ error: "The Botanist is busy. Please try again in a minute." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
      return fail("The diagnosis service is unavailable. Please try again shortly.", 502);
    }
    try {
      const data = await upstream.json() as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] };
      const choice = data.choices?.[0];
      if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") throw new Error("Incomplete diagnosis");
      return Response.json(parseBotanistReply(choice.message.content), { headers });
    } catch { return fail("The diagnosis was incomplete. Please try again.", 502); }
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return fail("The diagnosis timed out. Please try again.", 504);
    return fail("The Botanist is temporarily unavailable. Please try again.", 503);
  }
}
