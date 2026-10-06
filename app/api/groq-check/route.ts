import type { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Explicitly requested Next.js edge runtime. OpenNext's current Cloudflare
// adapter cannot deploy this runtime; see scripts/groq-check.md.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
const visionModel = "qwen/qwen3.8-27b";
// A synthetic 32x32 PNG; no member photo is used for this probe.
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAJklEQVR4nO3NMQ0AAAwDoPo33arYsQQMkB6LQCAQCAQCgUAg+BIMi1X0pjxKe0gAAAAASUVORK5CYII=";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== "zibuke-check") {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers });
  }

  let keySource: "cloudflare" | "process.env" | null = null;
  let authenticated = false;
  let stage: "binding" | "authentication" | "vision" = "binding";
  const fail = (error: string, status: number, upstreamStatus?: number) => Response.json({
    ok: false, keyBound: keySource !== null, keySource, authenticated,
    vision: { ok: false, model: visionModel }, stage, error,
    ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
  }, { status, headers });

  try {
    const cf = await getCloudflareContext({ async: true }).catch(() => null);
    const binding = cf?.env.GROQ_API_KEY;
    const apiKey = binding || process.env.GROQ_API_KEY;
    if (typeof apiKey !== "string" || !apiKey.trim()) return fail("GROQ_API_KEY_MISSING", 503);
    keySource = binding ? "cloudflare" : "process.env";
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(30000)]);
    const authorization = { Authorization: `Bearer ${apiKey}` };

    // The models endpoint checks authentication without inference cost.
    stage = "authentication";
    const models = await fetch("https://api.groq.com/openai/v1/models", {
      headers: authorization, cache: "no-store", redirect: "error", signal,
    });
    if (!models.ok) {
      await models.body?.cancel();
      return fail(models.status === 401 ? "GROQ_AUTHENTICATION_FAILED" : models.status === 403 ? "GROQ_ACCESS_DENIED" : models.status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_UNAVAILABLE", models.status === 429 ? 429 : 502, models.status);
    }
    const modelList: unknown = await models.json();
    if (!modelList || typeof modelList !== "object" || !Array.isArray((modelList as Record<string, unknown>).data)) {
      return fail("INVALID_GROQ_RESPONSE", 502);
    }
    authenticated = true;

    // An authenticated models listing alone does not prove image inference works.
    stage = "vision";
    const vision = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { ...authorization, "Content-Type": "application/json" },
      cache: "no-store", redirect: "error", signal,
      body: JSON.stringify({
        model: visionModel,
        messages: [{ role: "user", content: [
          { type: "text", text: "This is a synthetic health-check image. Reply with only OK." },
          { type: "image_url", image_url: { url: image } },
        ] }],
        max_completion_tokens: 256, stream: false,
      }),
    });
    if (!vision.ok) {
      await vision.body?.cancel();
      return fail(vision.status === 401 ? "GROQ_AUTHENTICATION_FAILED" : vision.status === 403 ? "GROQ_VISION_ACCESS_DENIED" : vision.status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_VISION_FAILED", vision.status === 429 ? 429 : 502, vision.status);
    }
    const data = await vision.json() as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] } | null;
    const choice = data?.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
      return fail("INVALID_VISION_RESPONSE", 502);
    }
    return Response.json({ ok: true, keyBound: true, keySource, authenticated: true,
      vision: { ok: true, model: visionModel } }, { headers });
  } catch (error) {
    return fail(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "GROQ_CHECK_TIMEOUT" : "GROQ_CHECK_FAILED", error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? 504 : 502);
  }
}
