import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { paymentOrders, subscriptions } from "@/db/schema";
import { constantEqual, hmacHex, moneyCents, peachSuccess, readLimitedBody } from "@/lib/payments";
import { need, paymentEnv, paymentOrigin, settleOrder } from "@/lib/payment-server";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = await paymentEnv(); const raw = await readLimitedBody(request);
    const timestamp = request.headers.get("x-webhook-timestamp") || "";
    const webhookId = request.headers.get("x-webhook-id") || "";
    const signature = request.headers.get("x-webhook-signature") || "";
    if (!/^\d+$/.test(timestamp) || Math.abs(Date.now()/1000 - Number(timestamp)) > 300 || !webhookId || !/^[a-f0-9]{64}$/i.test(signature)) return Response.json({ error: "Invalid signature" }, { status: 401 });
    const expected = await hmacHex(need(env, "PEACH_WEBHOOK_SECRET"), `${timestamp}.${webhookId}.${paymentOrigin(env)}/api/webhooks/peach.${raw}`);
    if (!constantEqual(expected, signature.toLowerCase())) return Response.json({ error: "Invalid signature" }, { status: 401 });
    const params = new URLSearchParams(raw);
    const reference = params.get("merchantTransactionId"); const transactionId = params.get("id");
    const code = params.get("result.code") || params.get("result_code") || "";
    const db = await getDb();
    const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, reference || ""), eq(paymentOrders.gateway, "peach_payments"))).limit(1);
    if (!order) return Response.json({ error: "Unknown order" }, { status: 404 });
    if (moneyCents(params.get("amount")) !== order.amountCents || params.get("currency") !== order.currency) return Response.json({ error: "Payment does not match the order" }, { status: 400 });
    if (order.providerId && order.providerId !== params.get("checkoutId")) return Response.json({ error: "Checkout mismatch" }, { status: 400 });
    if (!order.providerId) return Response.json({ error: "Checkout is still being recorded; retry" }, { status: 503 });
    const type = params.get("paymentType");
    if (transactionId && peachSuccess(code) && (type === "DB" || type === "CP")) {
      if (!order.renewalSubscriptionId && !params.get("registrationId")) return Response.json({ error: "Recurring registration is missing; reconcile payment" }, { status: 503 });
      await settleOrder(order, transactionId, params.get("registrationId") || undefined);
      revalidatePath(`/spaces/${order.spaceSlug}`); revalidatePath("/directory");
    } else if (peachSuccess(code) && ["RF", "RV", "CB"].includes(type || "")) {
      // Refunds/reversals revoke this order's grant, not other independently paid passes.
      await db.update(paymentOrders).set({ status: "refunded" }).where(eq(paymentOrders.id, order.id));
      await db.update(subscriptions).set({ status: "expired", currentPeriodEnd: new Date() }).where(eq(subscriptions.id, order.renewalSubscriptionId || order.id));
      revalidatePath(`/spaces/${order.spaceSlug}`);
    }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Webhook could not be processed" }, { status: 503 }); }
}
