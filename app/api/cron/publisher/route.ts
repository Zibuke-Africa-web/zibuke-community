import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { constantEqual } from "@/lib/payments";
import { publishNews } from "@/lib/automation/publisher";
import { observeServiceRun } from "@/lib/service-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function run(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const custom = request.headers.get("x-cron-secret");
  if (!secret || !((bearer && constantEqual(bearer, `Bearer ${secret}`)) || (custom && constantEqual(custom, secret)))) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await publishNews(env);
    // Always refresh on successful retry, including after a previous request
    // persisted its posts but failed during cache invalidation.
    for (const path of ["/", "/feed", "/spaces", "/spaces/welcome", "/spaces/general"]) revalidatePath(path);
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "News publisher is unavailable" }, { status: 503, headers }); }
}

export const GET = observeServiceRun("publisher", run);
export const POST = GET;
function methodNotAllowed() { return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } }); }
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
