import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/schema";
import { auth } from "@/auth";
import { getSpaceAccess } from "@/lib/space-access";
import { hmacHex, ikSigningPayload, isPaidSlug, nextMonth, readLimitedBody, type Gateway } from "@/lib/payments";

export async function paymentEnv() {
  const cf = await getCloudflareContext({ async: true }).catch(() => null);
  const aliases: Record<string, string[]> = {
    PEACH_CARD_ACCESS_TOKEN: ["PEACH_CARD_ACCESS_TOKEN", "PEACH_ACCESS_TOKEN"],
    PEACH_ACCESS_TOKEN: ["PEACH_ACCESS_TOKEN", "PEACH_CARD_ACCESS_TOKEN"],
    IKHOKHA_APP_ID: ["IKHOKHA_APP_ID", "IKHOKHA_APP_KEY"],
    IKHOKHA_APP_KEY: ["IKHOKHA_APP_KEY", "IKHOKHA_APP_ID"],
  };
  return new Proxy({} as Record<string, string | undefined>, { get: (_, key: string) => {
    const names = aliases[key] || [key];
    // All Worker aliases take precedence over local process fallbacks.
    for (const source of [cf?.env as unknown as Record<string, unknown> | undefined, process.env]) {
      for (const name of names) {
        const value = source?.[name];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    return undefined;
  } });
}
export function need(env: Record<string, string | undefined>, key: string) {
  const value = env[key];
  if (!value) {
    console.error("Payment configuration missing", { key });
    throw new Error("Payment provider is not configured.");
  }
  return value;
}
export function paymentOrigin(env: Record<string, string | undefined>) {
  const url = new URL(need(env, "PAYMENTS_APP_URL"));
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Payment origin must be an HTTPS origin.");
  return url.origin;
}
export function peachHosts(env: Record<string, string | undefined>) {
  if (env.PAYMENTS_MODE && !["live", "sandbox", "test"].includes(env.PAYMENTS_MODE)) throw new Error("Invalid payment mode");
  const live = env.PAYMENTS_MODE === "live";
  const checkout = live ? "https://secure.peachpayments.com" : "https://testsecure.peachpayments.com";
  if (env.PEACH_HOSTED_CHECKOUT_URL) {
    const configured = new URL(env.PEACH_HOSTED_CHECKOUT_URL);
    if (configured.origin !== checkout || !["/", "/v2/checkout"].includes(configured.pathname) || configured.username || configured.password || configured.search || configured.hash) {
      console.error("Payment configuration invalid", { key: "PEACH_HOSTED_CHECKOUT_URL" });
      throw new Error("Hosted checkout URL does not match payment mode");
    }
  }
  return { auth: live ? "https://dashboard.peachpayments.com" : "https://sandbox-dashboard.peachpayments.com",
    checkout,
    card: live ? "https://card.peachpayments.com" : "https://sandbox-card.peachpayments.com" };
}
async function gatewayJson(url: string, body: object, headers: Record<string, string> = {}) {
  const result = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body), redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!result.ok) throw new Error("The payment provider could not create checkout. Please try again later.");
  return await result.json() as Record<string, unknown>;
}
export async function peachToken(env: Record<string, string | undefined>) {
  const result = await gatewayJson(`${peachHosts(env).auth}/api/oauth/token`, {
    clientId: need(env, "PEACH_CLIENT_ID"), clientSecret: need(env, "PEACH_CLIENT_SECRET"), merchantId: need(env, "PEACH_MERCHANT_ID"),
  });
  if (typeof result.access_token !== "string") throw new Error("Unable to authenticate payment provider."); return result.access_token;
}
export function checkedCheckoutUrl(value: unknown, gateway: Gateway, env: Record<string, string | undefined>) {
  if (typeof value !== "string") throw new Error("Payment provider returned an invalid checkout.");
  const url = new URL(value);
  const hosts = gateway === "peach_payments" ? [new URL(peachHosts(env).checkout).hostname] : ["securepay.ikhokha.com", "securepay.ikhokha.red"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw new Error("Payment provider returned an invalid checkout.");
  return url.href;
}

export async function createCheckout(request: Request, gateway: Gateway) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const session = await auth(); if (!session?.user?.id) return Response.json({ error: "Sign in to choose a plan." }, { status: 401, headers });
    const env = await paymentEnv(); const origin = paymentOrigin(env);
    if (request.headers.get("origin") && request.headers.get("origin") !== origin) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    let input: { spaceSlug?: unknown };
    try { input = JSON.parse(await readLimitedBody(request, 4096)); }
    catch { return Response.json({ error: "Invalid checkout request." }, { status: 400, headers }); }
    if (!input || !isPaidSlug(input.spaceSlug)) return Response.json({ error: "Unknown membership plan." }, { status: 400, headers });
    const slug = input.spaceSlug;
    const access = await getSpaceAccess(slug, session.user.id);
    if (!access.space?.isPaywalled) return Response.json({ error: "This plan is not available." }, { status: 404, headers });
    if (access.allowed) return Response.json({ error: "You already have access. Manage your existing membership first." }, { status: 409, headers });
    const space = access.space;
    const currencies = (env[gateway === "peach_payments" ? "PEACH_CURRENCIES" : "IKHOKHA_CURRENCIES"] || "ZAR").split(",").map(value => value.trim());
    if (!/^[A-Z]{3}$/.test(space.currency) || !currencies.includes(space.currency)) return Response.json({ error: "This plan's currency is not enabled for this provider yet." }, { status: 503, headers });
    peachHosts(env); // Validate sandbox/live configuration before creating orders.
    if (gateway === "peach_payments") {
      ["PEACH_CLIENT_ID", "PEACH_CLIENT_SECRET", "PEACH_MERCHANT_ID", "PEACH_ENTITY_ID", "PEACH_CARD_ACCESS_TOKEN"].forEach(key => need(env, key));
      if (!env.PEACH_WEBHOOK_SECRET) need(env, "PEACH_SECRET_TOKEN");
      if (env.PEACH_RECURRING_ENABLED !== "true") throw new Error("Monthly billing is not enabled yet.");
    } else ["IKHOKHA_APP_ID", "IKHOKHA_APP_SECRET", "IKHOKHA_ENTITY_ID"].forEach(key => need(env, key));
    const db = await getDb();
    const [pending] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.userId, session.user.id), eq(paymentOrders.spaceSlug, slug), eq(paymentOrders.status, "pending"), sql`${paymentOrders.renewalSubscriptionId} is null`)).limit(1);
    if (pending) return Response.json({ error: "A checkout is already pending. Wait for payment confirmation or contact support before paying again." }, { status: 409, headers });
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const amount = gateway === "peach_payments" ? space.monthlyPriceCents : space.annualPriceCents;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("The membership price is not configured.");
    // OAuth failure cannot have charged the member; do not leave a pending order.
    const token = gateway === "peach_payments" ? await peachToken(env) : undefined;
    await db.insert(paymentOrders).values({ id, userId: session.user.id, spaceSlug: slug, gateway, billingCycle: gateway === "peach_payments" ? "monthly" : "annual", amountCents: amount, currency: space.currency });
    // Leave uncertain failures pending: never silently create another charge after a timeout.
    let result: Record<string, unknown>; let providerId: unknown; let checkout: unknown;
    if (gateway === "peach_payments") {
      result = await gatewayJson(`${peachHosts(env).checkout}/v2/checkout`, {
        authentication: { entityId: need(env, "PEACH_ENTITY_ID") }, merchantTransactionId: id,
        amount: amount / 100, currency: space.currency, paymentType: "DB", nonce: id,
        createRegistration: true, defaultPaymentMethod: "CARD", forceDefaultMethod: true,
        standingInstruction: { type: "RECURRING", mode: "INITIAL", source: "CIT", recurringType: "SUBSCRIPTION", frequency: "28", expiry: "9999-12-31" },
        shopperResultUrl: `${origin}/api/checkout/return?space=${slug}&order=${id}`,
        notificationUrl: `${origin}/api/webhooks/peach`,
      }, { Authorization: `Bearer ${token}`, Origin: origin });
      providerId = result.checkoutId; checkout = result.redirectUrl;
    } else {
      const path = "/public-api/v1/api/payment";
      const payload = { entityID: need(env, "IKHOKHA_ENTITY_ID"), externalEntityID: session.user.id,
        amount, currency: space.currency, requesterUrl: origin, paymentReference: id, externalTransactionID: id,
        mode: env.PAYMENTS_MODE === "live" ? "live" : "test",
        urls: { callbackUrl: `${origin}/api/webhooks/ikhokha`, successPageUrl: `${origin}/checkout/success?space=${slug}&payment=pending&order=${id}`,
          failurePageUrl: `${origin}/checkout/cancelled?space=${slug}&payment=failed&order=${id}`, cancelUrl: `${origin}/checkout/cancelled?space=${slug}&payment=canceled&order=${id}` } };
      result = await gatewayJson(`https://api.ikhokha.com${path}`, payload, {
        "IK-APPID": need(env, "IKHOKHA_APP_ID"), "IK-SIGN": await hmacHex(need(env, "IKHOKHA_APP_SECRET"), ikSigningPayload(path, JSON.stringify(payload))),
      });
      if (result.responseCode !== "00") throw new Error("The payment provider could not create checkout.");
      providerId = result.paylinkID; checkout = result.paylinkUrl;
    }
    if (typeof providerId !== "string" || !providerId) throw new Error("The payment provider returned an invalid reference.");
    const redirectUrl = checkedCheckoutUrl(checkout, gateway, env);
    await db.update(paymentOrders).set({ providerId, checkoutUrl: redirectUrl }).where(eq(paymentOrders.id, id));
    return Response.json({ redirectUrl }, { headers });
  } catch { return Response.json({ error: "Checkout is unavailable or awaiting confirmation. Please contact support if you already started a payment." }, { status: 503, headers }); }
}

// D1 batch is transactional. The receipt guard makes duplicate/reordered deliveries no-ops.
export async function settleOrder(order: typeof paymentOrders.$inferSelect, transactionId: string, registrationId?: string) {
  const db = await getDb(); const now = new Date();
  const end = order.periodEnd || (order.billingCycle === "annual" ? new Date(now.getTime() + 365 * 86400000) : nextMonth(now));
  const id = order.renewalSubscriptionId || order.id; const receipt = `${order.gateway}:${transactionId}`;
  const statements = [
    sql`insert into subscriptions (id,user_id,space_slug,gateway,billing_cycle,status,current_period_end,registration_id)
      select ${id},${order.userId},${order.spaceSlug},${order.gateway},${order.billingCycle},'active',${Math.floor(end.getTime()/1000)},${registrationId || null}
      where not exists(select 1 from payment_receipts where id=${receipt}) and exists(select 1 from payment_orders where id=${order.id} and status not in ('paid','refunded'))
      on conflict(id) do update set current_period_end=max(subscriptions.current_period_end,excluded.current_period_end),
        status=case when subscriptions.status='canceled' then 'canceled' else 'active' end,
        registration_id=coalesce(excluded.registration_id,subscriptions.registration_id), billing_review_reason=null`,
    sql`insert into space_members (id,space_id,user_id,role) select ${crypto.randomUUID()},id,${order.userId},'member' from spaces where slug=${order.spaceSlug}
      and exists(select 1 from subscriptions where id=${id})
      and not exists(select 1 from payment_receipts where id=${receipt} and order_id<>${order.id})
      on conflict(space_id,user_id) do nothing`,
    sql`update payment_orders set status='paid',review_reason=null where id=${order.id} and status<>'refunded'
      and not exists(select 1 from payment_receipts where id=${receipt} and order_id<>${order.id})`,
    sql`insert into payment_receipts(id,order_id) values(${receipt},${order.id}) on conflict(id) do nothing`,
  ];
  // Drizzle's raw db.run() cannot be batched by its D1 adapter in this version.
  // Compile parameterized SQL, then use D1's native atomic batch.
  const dialect = new SQLiteAsyncDialect();
  await db.$client.batch(statements.map(statement => {
    const query = dialect.sqlToQuery(statement);
    return db.$client.prepare(query.sql).bind(...query.params);
  }));
}

export async function flagPaymentReview(order: typeof paymentOrders.$inferSelect, reason: "declined" | "canceled" | "uncertain" | "mismatch", terminal = false) {
  const db = await getDb();
  const statements = [
    sql`update payment_orders set status=${terminal ? "failed" : "pending"},review_reason=${reason},last_checked_at=unixepoch() where id=${order.id} and status='pending'`,
    sql`update subscriptions set billing_review_reason=${reason} where id=${order.renewalSubscriptionId || ""}
      and exists(select 1 from payment_orders where id=${order.id} and status in ('pending','failed'))`,
  ];
  const dialect = new SQLiteAsyncDialect();
  await db.$client.batch(statements.map(statement => { const query = dialect.sqlToQuery(statement); return db.$client.prepare(query.sql).bind(...query.params); }));
}
