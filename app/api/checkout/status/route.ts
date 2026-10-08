import { auth } from "@/auth";
import { isPaidSlug } from "@/lib/payments";
import { checkoutStatus } from "@/lib/checkout-status";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return Response.json({ error: "Sign in to check your payment." }, { status: 401, headers });
    const url = new URL(request.url), slug = url.searchParams.get("space"), order = url.searchParams.get("order") || undefined;
    if (!isPaidSlug(slug) || (order && !/^[a-zA-Z0-9-]{1,100}$/.test(order))) return Response.json({ error: "Invalid payment reference." }, { status: 400, headers });
    return Response.json(await checkoutStatus(userId, slug, order), { headers });
  } catch { return Response.json({ error: "Confirmation is unavailable. Contact support before paying again." }, { status: 503, headers }); }
}
