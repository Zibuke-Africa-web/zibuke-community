import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { constantEqual } from "@/lib/payments";
import { publishNews, publisherDiagnostics } from "@/lib/automation/publisher";
import { observeServiceRun } from "@/lib/service-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function run(request: Request) {
  let result = publisherDiagnostics();
  try {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const custom = request.headers.get("x-cron-secret");
  if (process.env.NODE_ENV !== "development" && (!secret || !((bearer && constantEqual(bearer, `Bearer ${secret}`)) || (custom && constantEqual(custom, secret))))) {
    return Response.json({ ...result, errors: ["Unauthorized"] }, { status: 401, headers });
  }
    result = await publishNews(env);
    // Always refresh on successful retry, including after a previous request
    // persisted its posts but failed during cache invalidation.
    if (result.success || result.articlesSaved) for (const path of ["/", "/feed", "/spaces"]) revalidatePath(path, "layout");
    return Response.json(result, { status: result.success ? 200 : 503, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Publisher runner failed", message);
    return Response.json({ ...result, success: false, errors: [...result.errors, message] }, { status: 503, headers });
  }
}

export const GET = observeServiceRun("publisher", run);
export const POST = GET;
function methodNotAllowed() { return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } }); }
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
