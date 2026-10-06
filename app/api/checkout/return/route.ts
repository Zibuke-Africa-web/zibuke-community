import { isPaidSlug } from "@/lib/payments";
import { paymentEnv, paymentOrigin } from "@/lib/payment-server";
export const dynamic = "force-dynamic";
// Browser returns do not grant access. The signed webhook is the source of truth.
export async function POST(request: Request) {
  const slug = new URL(request.url).searchParams.get("space");
  const origin = paymentOrigin(await paymentEnv());
  return Response.redirect(`${origin}${isPaidSlug(slug) ? `/spaces/${slug}?payment=pending` : "/spaces"}`, 303);
}
