import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentOrders, subscriptions } from "@/db/schema";
import { constantEqual, moneyCents, nextMonth, peachSuccess } from "@/lib/payments";
import { need, paymentEnv, peachHosts, settleOrder } from "@/lib/payment-server";
export const dynamic = "force-dynamic";

type CardPayment = { id?: string; amount?: string; currency?: string; merchantTransactionId?: string; registrationId?: string; result?: { code?: string }; paymentType?: string };
export async function POST(request: Request) {
  try {
    const env = await paymentEnv(); const secret = env.CRON_SECRET;
    if (!secret || !constantEqual(`Bearer ${secret}`, request.headers.get("authorization") || "")) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (env.PEACH_RECURRING_ENABLED !== "true") return Response.json({ error: "Recurring billing not enabled" }, { status: 503 });
    const db = await getDb(); const host = peachHosts(env).card;
    const headers = { Authorization: `Bearer ${need(env, "PEACH_CARD_ACCESS_TOKEN")}`, "Content-Type": "application/x-www-form-urlencoded" };
    const entity = need(env, "PEACH_ENTITY_ID");
    async function apply(order: typeof paymentOrders.$inferSelect, result: CardPayment) {
      if (result.merchantTransactionId !== order.id || moneyCents(result.amount) !== order.amountCents || result.currency !== order.currency) return;
      if (result.id && result.paymentType === "DB" && peachSuccess(result.result?.code || "")) await settleOrder(order, result.id, result.registrationId);
    }
    // Reconcile uncertain requests; never re-submit a charge whose outcome is unknown.
    const uncertain = await db.select().from(paymentOrders).where(and(eq(paymentOrders.gateway, "peach_payments"), eq(paymentOrders.status, "pending"), sql`${paymentOrders.renewalSubscriptionId} is not null`, sql`${paymentOrders.createdAt}<unixepoch()-120`)).limit(10);
    for (const order of uncertain) {
      const url = new URL(`${host}/v1/query/`); url.searchParams.set("entityId", entity); url.searchParams.set("merchantTransactionId", order.id);
      const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const result = await response.json() as { payments?: CardPayment[] };
        for (const payment of result.payments || []) await apply(order, payment);
      }
    }
    const due = await db.select().from(subscriptions).where(and(eq(subscriptions.status, "active"), eq(subscriptions.gateway, "peach_payments"),
      sql`${subscriptions.registrationId} is not null`, sql`${subscriptions.currentPeriodEnd}<=unixepoch()`, sql`${subscriptions.currentPeriodEnd}>unixepoch()-172800`)).limit(10);
    let submitted = 0;
    for (const sub of due) {
      const [original] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, sub.id)).limit(1);
      if (!original) continue;
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sub.id}:${sub.currentPeriodEnd.getTime()}`));
      const id = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("").slice(0, 16);
      const end = nextMonth(sub.currentPeriodEnd);
      const claimed = await db.all<{ id: string }>(sql`insert into payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,renewal_subscription_id,period_end)
        select ${id},user_id,space_slug,'peach_payments','monthly',${original.amountCents},${original.currency},id,${Math.floor(end.getTime()/1000)}
        from subscriptions where id=${sub.id} and status='active' and current_period_end=${Math.floor(sub.currentPeriodEnd.getTime()/1000)} on conflict(id) do nothing returning id`);
      if (!claimed.length) continue;
      const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1);
      const body = new URLSearchParams({ entityId: entity, amount: (order.amountCents/100).toFixed(2), currency: order.currency, paymentType: "DB", merchantTransactionId: id,
        "standingInstruction.type": "RECURRING", "standingInstruction.mode": "REPEATED", "standingInstruction.source": "MIT", "standingInstruction.recurringType": "SUBSCRIPTION" });
      const response = await fetch(`${host}/v1/registrations/${encodeURIComponent(sub.registrationId!)}/payments`, { method: "POST", headers, body, redirect: "follow", signal: AbortSignal.timeout(20000) });
      submitted++;
      if (response.ok) await apply(order, await response.json() as CardPayment);
    }
    return Response.json({ ok: true, submitted, reconciled: uncertain.length });
  } catch { return Response.json({ error: "Billing run needs retry or reconciliation; no uncertain charge will be resubmitted." }, { status: 503 }); }
}
