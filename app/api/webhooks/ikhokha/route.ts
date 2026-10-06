import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/schema";
import { constantEqual, hmacHex, ikSigningPayload, readLimitedBody } from "@/lib/payments";
import { need, paymentEnv, settleOrder } from "@/lib/payment-server";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = await paymentEnv(); const raw = await readLimitedBody(request);
    const signature = request.headers.get("ik-sign") || "";
    if (request.headers.get("ik-appid") !== need(env, "IKHOKHA_APP_ID") || !/^[a-f0-9]{64}$/i.test(signature)) return Response.json({ error: "Invalid signature" }, { status: 401 });
    const expected = await hmacHex(need(env, "IKHOKHA_APP_SECRET"), ikSigningPayload("/api/webhooks/ikhokha", raw));
    if (!constantEqual(expected, signature.toLowerCase())) return Response.json({ error: "Invalid signature" }, { status: 401 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.paylinkID !== "string") return Response.json({ error: "Invalid payment reference" }, { status: 400 });
    const [order] = await (await getDb()).select().from(paymentOrders).where(and(eq(paymentOrders.providerId, body.paylinkID), eq(paymentOrders.gateway, "ikhokha"))).limit(1);
    if (!order) return Response.json({ error: "Payment reference is not yet recorded; retry" }, { status: 503 });
    if (body.externalTransactionID !== undefined && body.externalTransactionID !== order.id) return Response.json({ error: "Reference mismatch" }, { status: 400 });
    if (body.amount !== undefined && body.amount !== order.amountCents || body.currency !== undefined && body.currency !== order.currency) return Response.json({ error: "Amount mismatch" }, { status: 400 });
    if (body.status === "SUCCESS") {
      // The signed paylink ID binds the amount, currency and member fixed at checkout.
      await settleOrder(order, body.paylinkID);
      revalidatePath(`/spaces/${order.spaceSlug}`); revalidatePath("/directory");
    } else if (body.status === "FAILURE") {
      await (await getDb()).update(paymentOrders).set({ status: "failed" }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "pending")));
    }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Webhook could not be processed" }, { status: 503 }); }
}
