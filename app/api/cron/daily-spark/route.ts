import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { generateDailySpark } from "@/lib/daily-spark-server";

// OpenNext requires nodejs; this still deploys to Cloudflare Workers.
// Next.js runtime = "edge" is unsupported by @opennextjs/cloudflare.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.CRON_SECRET) return Response.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503, headers });
    if (request.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    const result = await generateDailySpark(env);
    revalidatePath("/feed");
    revalidatePath("/", "layout");
    return Response.json({ success: true, ...result }, { headers });
  } catch {
    return Response.json({ error: "SPARK_GENERATION_FAILED", message: "Please retry or check the scheduler configuration." }, { status: 503, headers });
  }
}

export async function GET(request: Request) { return POST(request); }
