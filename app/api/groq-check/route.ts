import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { groqModels, groqReasoningOptions } from "@/lib/groq-config";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Groq-Check-Version": "2026-10-06-model-config-v2" };

export async function GET(req: NextRequest) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
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
        error: "Diagnostic service is unavailable",
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
      message: "Text inference succeeded",
      model,
    }, { headers });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Diagnostic service is unavailable" },
      { status: 500, headers }
    );
  }
}
