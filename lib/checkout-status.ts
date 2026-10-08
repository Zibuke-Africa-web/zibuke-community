import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/schema";

export async function checkoutStatus(userId: string, slug: string, orderId?: string) {
  const [order] = await (await getDb()).select().from(paymentOrders).where(and(
    eq(paymentOrders.userId, userId), eq(paymentOrders.spaceSlug, slug), orderId ? eq(paymentOrders.id, orderId) : undefined,
  )).orderBy(desc(paymentOrders.createdAt), desc(paymentOrders.id)).limit(1);
  if (!order) return { status: "unknown", message: "No payment confirmation is available. If you already paid, contact support before trying again." };
  if (order.status === "paid") return { status: "paid", message: "Payment confirmed. Refresh access to open your membership." };
  if (order.status === "refunded") return { status: "refunded", message: "This payment was refunded or reversed. Contact support if you need help with your membership." };
  if (order.status === "failed") return { status: "failed", message: order.reviewReason === "canceled" ? "Checkout was canceled. No membership was activated by this payment. You can choose a plan again." : "The payment was declined or failed. No membership was activated by this payment. Check with your bank before trying again." };
  if (order.reviewReason || Date.now() - order.createdAt.getTime() > 600_000) return { status: "review", message: "Payment confirmation needs review. Contact support before paying again; an earlier payment may still complete." };
  return { status: "pending", message: "Waiting for secure payment confirmation. We will check for up to one minute. Do not pay again while confirmation is pending." };
}
