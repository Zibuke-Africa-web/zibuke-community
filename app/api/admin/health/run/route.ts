import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminAccess } from "@/lib/admin-access";
import { paymentEnv } from "@/lib/payment-server";
import { readLimitedBody } from "@/lib/payments";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const access = await adminAccess();
    if (!access.allowed) return Response.json({ error: "Admin access required" }, { status: access.status, headers });
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    let service: unknown;
    try { service = (JSON.parse(await readLimitedBody(request, 1024)) as { service?: unknown })?.service; }
    catch { return Response.json({ error: "Invalid request" }, { status: 400, headers }); }
    if (service !== "publisher" && service !== "billing") return Response.json({ error: "Unknown service" }, { status: 400, headers });
    const { env } = await getCloudflareContext({ async: true });
    const secret = (await paymentEnv()).CRON_SECRET;
    if (!secret || !env.WORKER_SELF_REFERENCE) return Response.json({ error: "Internal service binding or cron secret is missing" }, { status: 503, headers });
    const result = await env.WORKER_SELF_REFERENCE.fetch(`https://zibukecommunity.co.za/api/cron/${service}`, {
      method: "POST", headers: { authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(300000),
    });
    // Never relay internal headers, bindings or raw exception/provider messages.
    if (!result.ok) { await result.body?.cancel(); return Response.json({ error: "Run did not complete successfully. Review the health panel before retrying." }, { status: 503, headers }); }
    const body = await result.json() as { skipped?: unknown; articlesIngested?: unknown; submitted?: unknown };
    const count = service === "publisher" ? body.articlesIngested : body.submitted;
    return Response.json({ success: true, message: body.skipped ? "Billing is disabled; no charges were submitted." : `${service === "publisher" ? "Publisher" : "Billing"} run completed.`, count: typeof count === "number" && Number.isFinite(count) ? count : 0 }, { headers });
  } catch { return Response.json({ error: "Run could not be confirmed. Refresh health before retrying." }, { status: 503, headers }); }
}
