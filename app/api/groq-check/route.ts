import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { groqModels, groqReasoningOptions } from "@/lib/groq-config";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Groq-Check-Version": "2026-10-06-model-config-v2" };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "zibuke-check") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let apiKey: string | undefined;
  let cfEnv: Record<string, unknown> | null = null;
  let model = groqModels().text;

  try {
    const cf = await getCloudflareContext({ async: true });
    cfEnv = (cf?.env as unknown as Record<string, unknown>) || null;
    const binding = cfEnv?.GROQ_API_KEY;
    apiKey = (typeof binding === "string" ? binding : undefined) || process.env.GROQ_API_KEY;
    model = groqModels(cf.env).text;
  } catch {
    apiKey = process.env.GROQ_API_KEY;
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "GROQ_API_KEY is not configured in Cloudflare bindings or process.env",
        bindingsDetected: cfEnv ? Object.keys(cfEnv) : [],
      },
      { status: 200, headers }
    );
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model, ...groqReasoningOptions(model),
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 512,
      }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(30000)]),
    });

    const data: unknown = await groqRes.json().catch(() => ({}));

    if (!groqRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Groq Cloud rejected the request",
          groqStatus: groqRes.status,
          model,
          hint: groqRes.status === 404 ? "The configured model is unavailable to this Groq project. Set GROQ_TEXT_MODEL to a model your project can access." : undefined,
          details: data,
        },
        { status: 200, headers }
      );
    }

    const choice = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0];
    if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) {
      return NextResponse.json({ ok: false, error: "Groq returned no text completion", model }, { status: 502, headers });
    }
    return NextResponse.json({
      ok: true,
      message: "Groq API is verified and working on live Cloudflare Worker!",
      model,
      maskedKey: apiKey.slice(0, 6) + "..." + apiKey.slice(-4),
      hasCloudflareAi: Boolean(cfEnv?.AI),
    }, { headers });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message || "Failed to fetch Groq Cloud" : "Failed to fetch Groq Cloud" },
      { status: 500, headers }
    );
  }
}
