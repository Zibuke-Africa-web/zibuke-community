import { isPaidSlug, peachDeclined, readLimitedBody } from "@/lib/payments";
import { paymentEnv, paymentOrigin } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
// Browser return fields are display hints only. They never mutate payment state
// or grant access; the member's status is read separately from owned D1 orders.
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("space");
    const fields = request.method === "POST" ? new URLSearchParams(await readLimitedBody(request, 8192)) : url.searchParams;
    const code = fields.get("result.code") || fields.get("result_code") || "";
    const state = code === "100.396.101" ? "canceled" : peachDeclined(code) ? "failed" : code === "100.396.104" ? "review" : "pending";
    const origin = paymentOrigin(await paymentEnv());
    const target = new URL(isPaidSlug(slug) ? `/checkout/${state === "canceled" || state === "failed" ? "cancelled" : "success"}` : "/spaces", origin);
    if (isPaidSlug(slug)) {
      target.searchParams.set("payment", state);
      target.searchParams.set("space", slug);
      const order = url.searchParams.get("order");
      if (order && /^[a-f0-9]{16}$/.test(order)) target.searchParams.set("order", order);
    }
    return new Response(null, { status: 303, headers: { Location: target.href, "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Could not confirm this return. Open your space to check access, or contact support before paying again." }, { status: 503 }); }
}
export const GET = handle;
export const POST = handle;
