import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "zibuke-check") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let apiKey: string | undefined;
  let cfEnv: Record<string, unknown> | null = null;

  try {
    const cf = await getCloudflareContext({ async: true });
    cfEnv = (cf?.env as unknown as Record<string, unknown>) || null;
    const binding = cfEnv?.GROQ_API_KEY;
    apiKey = (typeof binding === "string" ? binding : undefined) || process.env.GROQ_API_KEY;
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
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
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
          details: data,
        },
        { status: 200, headers }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Groq API is verified and working on live Cloudflare Worker!",
      model: "llama-3.1-8b-instant",
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
