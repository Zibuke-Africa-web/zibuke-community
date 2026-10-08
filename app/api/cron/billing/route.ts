import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { paymentOrders, subscriptions } from "@/db/schema";
import { constantEqual, moneyCents, nextMonth, peachDeclined, peachSuccess } from "@/lib/payments";
import { flagPaymentReview, need, paymentEnv, peachHosts, settleOrder } from "@/lib/payment-server";
import { observeServiceRun } from "@/lib/service-runs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const responseHeaders = { "Cache-Control": "no-store" };
type CardPayment = { id?: string; amount?: string; currency?: string; merchantTransactionId?: string; registrationId?: string; result?: { code?: string }; paymentType?: string };

async function run(request: Request) {
  try {
    const env = await paymentEnv(); const secret = env.CRON_SECRET;
    const bearer = request.headers.get("authorization") || "";
    const custom = request.headers.get("x-cron-secret") || "";
    if (!secret || !(constantEqual(`Bearer ${secret}`, bearer) || constantEqual(secret, custom))) return Response.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });
    if (env.PEACH_RECURRING_ENABLED !== "true") return Response.json({ ok: true, skipped: "Recurring billing disabled", submitted: 0 }, { headers: responseHeaders });
    const db = await getDb(); const host = peachHosts(env).card;
    const headers = { Authorization: `Bearer ${need(env, "PEACH_CARD_ACCESS_TOKEN")}`, "Content-Type": "application/x-www-form-urlencoded" };
    const entity = need(env, "PEACH_ENTITY_ID");
    const currencies = (env.PEACH_CURRENCIES || "ZAR").split(",").map(value => value.trim());
    let submitted = 0, reconciled = 0, failures = 0;
    async function apply(order: typeof paymentOrders.$inferSelect, result: CardPayment) {
      if (!result || result.merchantTransactionId !== order.id || moneyCents(result.amount) !== order.amountCents || result.currency !== order.currency || result.paymentType !== "DB") {
        await flagPaymentReview(order, "mismatch"); return;
      }
      const code = result.result?.code || "";
      if (result.id && peachSuccess(code)) {
        await settleOrder(order, result.id, result.registrationId);
        revalidatePath(`/spaces/${order.spaceSlug}`);
      } else if (peachDeclined(code)) await flagPaymentReview(order, "declined", true);
      else await flagPaymentReview(order, "uncertain");
    }
    // /v1/query has a two-per-minute provider limit. Rotate oldest checked
    // orders; an atomic lease prevents overlapping runs querying the same order.
    const uncertain = await db.select().from(paymentOrders).where(and(eq(paymentOrders.gateway, "peach_payments"), eq(paymentOrders.status, "pending"),
      sql`${paymentOrders.renewalSubscriptionId} is not null`, sql`${paymentOrders.createdAt}<unixepoch()-120`,
      sql`(${paymentOrders.lastCheckedAt} is null or ${paymentOrders.lastCheckedAt}<unixepoch()-120)`))
      .orderBy(asc(paymentOrders.lastCheckedAt), asc(paymentOrders.createdAt), asc(paymentOrders.id)).limit(2);
    for (const order of uncertain) {
      const lease = await db.update(paymentOrders).set({ lastCheckedAt: new Date() }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "pending"),
        sql`(${paymentOrders.lastCheckedAt} is null or ${paymentOrders.lastCheckedAt}<unixepoch()-120)`)).returning({ id: paymentOrders.id });
      if (!lease.length) continue;
      try {
        const url = new URL(`${host}/v1/query/`); url.searchParams.set("entityId", entity); url.searchParams.set("merchantTransactionId", order.id);
        const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("Reconciliation unavailable");
        const result = await response.json() as { payments?: CardPayment[] };
        if (!Array.isArray(result.payments) || !result.payments.length) await flagPaymentReview(order, "uncertain");
        else for (const payment of result.payments) await apply(order, payment);
        reconciled++;
      } catch { failures++; await flagPaymentReview(order, "uncertain"); }
    }
    // Never catch up old missed months or bill a tokenless subscription silently.
    await db.update(subscriptions).set({ billingReviewReason: "overdue_or_missing_token" }).where(and(
      eq(subscriptions.status, "active"), eq(subscriptions.gateway, "peach_payments"), eq(subscriptions.billingCycle, "monthly"),
      sql`${subscriptions.billingReviewReason} is null`, sql`${subscriptions.currentPeriodEnd}<=unixepoch()`,
      sql`(${subscriptions.currentPeriodEnd}<=unixepoch()-172800 or ${subscriptions.registrationId} is null or ${subscriptions.registrationId}='')`,
    ));
    const due = await db.select().from(subscriptions).where(and(eq(subscriptions.status, "active"), eq(subscriptions.gateway, "peach_payments"), eq(subscriptions.billingCycle, "monthly"),
      sql`${subscriptions.billingReviewReason} is null`, sql`${subscriptions.registrationId} is not null`, sql`${subscriptions.registrationId}<>''`,
      sql`${subscriptions.currentPeriodEnd}<=unixepoch()`, sql`${subscriptions.currentPeriodEnd}>unixepoch()-172800`))
      .orderBy(asc(subscriptions.currentPeriodEnd), asc(subscriptions.id)).limit(10);
    for (const sub of due) {
      const [original] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, sub.id)).limit(1);
      if (!original || original.status !== "paid" || original.billingCycle !== "monthly" || original.gateway !== "peach_payments" || !currencies.includes(original.currency) || !/^[A-Z]{3}$/.test(original.currency) || !Number.isSafeInteger(original.amountCents) || original.amountCents <= 0) {
        await db.update(subscriptions).set({ billingReviewReason: "invalid_original_order" }).where(eq(subscriptions.id, sub.id)); continue;
      }
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sub.id}:${sub.currentPeriodEnd.getTime()}`));
      const id = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("").slice(0, 16);
      const end = nextMonth(sub.currentPeriodEnd);
      const claimed = await db.all<{ id: string }>(sql`insert into payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,renewal_subscription_id,period_end)
        select ${id},user_id,space_slug,'peach_payments','monthly',${original.amountCents},${original.currency},id,${Math.floor(end.getTime()/1000)}
        from subscriptions where id=${sub.id} and status='active' and billing_cycle='monthly' and gateway='peach_payments'
          and billing_review_reason is null and registration_id=${sub.registrationId}
          and current_period_end=${Math.floor(sub.currentPeriodEnd.getTime()/1000)} on conflict(id) do nothing returning id`);
      if (!claimed.length) continue;
      const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1);
      try {
        const body = new URLSearchParams({ entityId: entity, amount: (order.amountCents/100).toFixed(2), currency: order.currency, paymentType: "DB", merchantTransactionId: id,
          "standingInstruction.type": "RECURRING", "standingInstruction.mode": "REPEATED", "standingInstruction.source": "MIT", "standingInstruction.recurringType": "SUBSCRIPTION" });
        submitted++;
        const response = await fetch(`${host}/v1/registrations/${encodeURIComponent(sub.registrationId!)}/payments`, { method: "POST", headers, body, redirect: "follow", signal: AbortSignal.timeout(20000) });
        // Peach also returns valid decline payloads with HTTP 400.
        if (!response.ok && response.status !== 400) throw new Error("Charge outcome unknown");
        await apply(order, await response.json() as CardPayment);
      } catch { failures++; await flagPaymentReview(order, "uncertain"); }
    }
    if (failures) console.error("Billing requests require reconciliation", { count: failures });
    return Response.json({ ok: failures === 0, submitted, reconciled, failures }, { status: failures ? 503 : 200, headers: responseHeaders });
  } catch { return Response.json({ error: "Billing run needs retry or reconciliation; no uncertain charge will be resubmitted." }, { status: 503, headers: responseHeaders }); }
}
export const GET = observeServiceRun("billing", run);
export const POST = GET;
function methodNotAllowed() { return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: "GET, POST" } }); }
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
