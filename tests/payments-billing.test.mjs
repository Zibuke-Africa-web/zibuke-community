import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { setup } from './helpers/payments-harness.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

function order(h, id = 'monthly', user = 'alice') {
  h.sqlite.prepare("INSERT INTO payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,provider_id) VALUES (?,?,'greenspace-hub','peach_payments','monthly',5000,'ZAR',?)").run(id, user, `checkout-${id}`);
}
async function subscription(h, id = 'monthly', user = 'alice') {
  order(h, id, user);
  const actual = (await h.db.select().from(h.load('db/schema').paymentOrders)).find(row => row.id === id);
  await h.load('lib/payment-server').settleOrder(actual, `initial-${id}`, `token-${id}`);
  h.sqlite.prepare('UPDATE subscriptions SET current_period_end=unixepoch()-5 WHERE id=?').run(id);
}
const cron = (headers = { authorization: 'Bearer fixture-cron' }, method = 'POST') => new Request('https://community.example/api/cron/billing', { method, headers });
function approved(options, overrides = {}) {
  const form = new URLSearchParams(options.body);
  return { id: `debit-${form.get('merchantTransactionId')}`, merchantTransactionId: form.get('merchantTransactionId'), amount: '50.00', currency: 'ZAR', paymentType: 'DB', result: { code: '000.000.000' }, ...overrides };
}
function checkoutRequest() { return new Request('https://community.example/api/checkout/peach', { method: 'POST', headers: { origin: 'https://community.example' }, body: JSON.stringify({ spaceSlug: 'greenspace-hub' }) }); }
async function peachWebhook(h, fields = {}, options = {}) {
  const body = new URLSearchParams({ merchantTransactionId: 'monthly', id: 'payment', checkoutId: 'checkout-monthly', amount: '50.00', currency: 'ZAR', paymentType: 'DB', registrationId: 'token', 'result.code': '000.000.000', ...fields });
  const raw = body.toString(); const timestamp = String(Math.floor(Date.now()/1000) + (options.offset || 0));
  const signature = createHmac('sha256', options.secret || h.env.PEACH_WEBHOOK_SECRET).update(`${timestamp}.delivery.https://community.example/api/webhooks/peach.${raw}`).digest('hex');
  return h.load('app/api/webhooks/peach/route').POST(new Request('https://community.example/api/webhooks/peach', { method: 'POST', body: options.tampered ? raw + '&amount=1' : raw,
    headers: { 'x-webhook-timestamp': timestamp, 'x-webhook-id': 'delivery', 'x-webhook-signature': signature } }));
}

test('credentials prefer Worker bindings and aliases, then nonempty process fallbacks', async t => {
  const h = setup(t);
  delete h.env.PEACH_CARD_ACCESS_TOKEN; delete h.env.IKHOKHA_APP_ID;
  Object.assign(h.env, { PEACH_ACCESS_TOKEN: 'worker-access', IKHOKHA_APP_KEY: 'worker-key', PEACH_SECRET_TOKEN: 'signing-only' });
  Object.assign(h.processEnv, { PEACH_CARD_ACCESS_TOKEN: 'process-access', IKHOKHA_APP_ID: 'process-key', PEACH_ENTITY_ID: 'process-entity', PEACH_HOSTED_CHECKOUT_URL: 'https://testsecure.peachpayments.com/v2/checkout' });
  const { paymentEnv, peachHosts } = h.load('lib/payment-server');
  let env = await paymentEnv();
  assert.equal(env.PEACH_CARD_ACCESS_TOKEN, 'worker-access'); assert.equal(env.IKHOKHA_APP_ID, 'worker-key');
  assert.equal(env.PEACH_ENTITY_ID, 'fixture-entity'); assert.equal(env.PEACH_SECRET_TOKEN, 'signing-only');
  assert.equal(peachHosts(env).checkout, 'https://testsecure.peachpayments.com');
  h.env.PEACH_ACCESS_TOKEN = ' ';
  env = await paymentEnv();
  assert.equal(env.PEACH_CARD_ACCESS_TOKEN, 'process-access');
  delete h.processEnv.PEACH_CARD_ACCESS_TOKEN;
  assert.equal(env.PEACH_CARD_ACCESS_TOKEN, undefined, 'signing token is never treated as a card bearer');
  h.env.PAYMENTS_MODE = 'live'; env = await paymentEnv(); assert.throws(() => peachHosts(env));
  h.env.PEACH_HOSTED_CHECKOUT_URL = 'https://secure.peachpayments.com/v2/checkout';
  env = await paymentEnv();
  assert.equal(peachHosts(env).checkout, 'https://secure.peachpayments.com');
  h.env.PEACH_HOSTED_CHECKOUT_URL = 'https://evil.example/v2/checkout'; env = await paymentEnv(); assert.throws(() => peachHosts(env));
});

test('missing credentials log only configuration names and OAuth failure leaves no pending order', async t => {
  const h = setup(t); const { createCheckout } = h.load('lib/payment-server');
  const response = await createCheckout(checkoutRequest(), 'peach_payments');
  assert.equal(response.status, 503);
  assert.ok(JSON.stringify(h.logs).includes('PEACH_CLIENT_ID'));
  assert.ok(!JSON.stringify(h.logs).includes('fixture-token'));
  assert.equal(h.network.length, 0);
  Object.assign(h.env, { PEACH_CLIENT_ID: 'client', PEACH_CLIENT_SECRET: 'do-not-log-secret', PEACH_MERCHANT_ID: 'merchant' });
  h.fetch(async () => new Response('do-not-log-secret', { status: 401 }));
  const failed = await createCheckout(checkoutRequest(), 'peach_payments');
  assert.equal(failed.status, 503);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM payment_orders').get().n, 0);
  assert.ok(!(await failed.text()).includes('do-not-log-secret'));
  assert.ok(!JSON.stringify(h.logs).includes('do-not-log-secret'));
});

test('Peach signatures reject wrong keys, stale deliveries, tampering and currency changes', async t => {
  const h = setup(t); order(h);
  assert.equal((await peachWebhook(h, {}, { secret: 'wrong' })).status, 401);
  assert.equal((await peachWebhook(h, {}, { offset: -600 })).status, 401);
  assert.equal((await peachWebhook(h, {}, { tampered: true })).status, 400);
  assert.equal((await peachWebhook(h, { currency: 'USD' })).status, 400);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n, 0);
  assert.equal((await peachWebhook(h)).status, 200);
  const end = h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end;
  assert.equal((await peachWebhook(h)).status, 200);
  assert.equal(h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end, end);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'paid');
});

test('classic Peach secret token verifies sorted payload without weakening configured header signing', async t => {
  const h = setup(t); order(h); delete h.env.PEACH_WEBHOOK_SECRET; h.env.PEACH_SECRET_TOKEN = 'classic-fixture';
  const params = new URLSearchParams({ merchantTransactionId: 'monthly', id: 'classic-payment', checkoutId: 'checkout-monthly', amount: '50.00', currency: 'ZAR', paymentType: 'DB', registrationId: 'token', 'result.code': '000.000.000' });
  const message = [...params.keys()].sort().map(key => key + params.get(key)).join('');
  params.set('signature', createHmac('sha256', h.env.PEACH_SECRET_TOKEN).update(message).digest('hex'));
  const send = () => h.load('app/api/webhooks/peach/route').POST(new Request('https://community.example/api/webhooks/peach', { method: 'POST', body: params.toString() }));
  h.env.PEACH_WEBHOOK_SECRET = 'header-fixture'; assert.equal((await send()).status, 401);
  delete h.env.PEACH_WEBHOOK_SECRET;
  assert.equal((await send()).status, 200);
  params.set('amount', '1.00'); assert.equal((await send()).status, 401);
});

test('settlement rolls back both tables when a D1 batch statement fails', async t => {
  const h = setup(t); order(h);
  h.sqlite.exec("CREATE TRIGGER reject_paid BEFORE UPDATE ON payment_orders WHEN NEW.status='paid' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  assert.equal((await peachWebhook(h)).status, 503);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n, 0);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM payment_receipts').get().n, 0);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM space_members').get().n, 0);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'pending');
});

test('signed declines release initial holds, uncertainty does not, and later success wins', async t => {
  const h = setup(t); order(h);
  assert.equal((await peachWebhook(h, { 'result.code': '100.396.104' })).status, 200);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'pending');
  assert.equal((await peachWebhook(h, { 'result.code': '800.100.152' })).status, 200);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'failed');
  assert.equal((await peachWebhook(h)).status, 200);
  assert.equal((await peachWebhook(h, { 'result.code': '100.396.101' })).status, 200);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'paid');
});

test('billing GET and POST reject missing or invalid secrets and support both authenticated headers', async t => {
  const h = setup(t); const route = h.load('app/api/cron/billing/route');
  for (const method of ['GET', 'POST']) {
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { 'x-cron-secret': 'wrong' }]) assert.equal((await route[method](cron(headers, method))).status, 401);
    assert.equal((await route[method](cron({ 'x-cron-secret': 'fixture-cron' }, method))).status, 200);
  }
  delete h.env.CRON_SECRET; assert.equal((await route.POST(cron())).status, 401);
  assert.equal(h.network.length, 0);
  assert.equal(route.DELETE().status, 405);
});

test('monthly renewal is claimed once during overlap and advances exactly one calendar month', async t => {
  const h = setup(t); await subscription(h);
  const end = h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end;
  h.fetch(async (url, options) => {
    assert.match(String(url), /registrations\/token-monthly\/payments$/);
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('currency'), 'ZAR'); assert.equal(form.get('amount'), '50.00');
    assert.equal(form.get('standingInstruction.source'), 'MIT');
    return Response.json(approved(options));
  });
  const { POST } = h.load('app/api/cron/billing/route');
  const responses = await Promise.all([POST(cron()), POST(cron())]);
  assert.ok(responses.every(response => response.status === 200)); assert.equal(h.network.length, 1);
  const next = h.load('lib/payments').nextMonth(new Date(end * 1000));
  assert.equal(h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end, next.getTime()/1000);
  assert.equal(h.sqlite.prepare("SELECT status FROM payment_orders WHERE renewal_subscription_id IS NOT NULL").get().status, 'paid');
  await POST(cron()); assert.equal(h.network.length, 1);
  assert.equal(h.load('lib/payments').nextMonth(new Date('2028-01-31T12:00:00Z')).toISOString(), '2028-02-29T12:00:00.000Z');
});

test('billing excludes annual, canceled, future and out-of-window subscriptions', async t => {
  const h = setup(t); await subscription(h); const { POST } = h.load('app/api/cron/billing/route');
  for (const update of ["billing_cycle='annual'", "billing_cycle='monthly',status='canceled'", "status='active',current_period_end=unixepoch()+60", "current_period_end=unixepoch()-172801"]) {
    h.sqlite.exec(`UPDATE subscriptions SET ${update}`);
    assert.equal((await POST(cron())).status, 200);
  }
  assert.equal(h.network.length, 0);
  assert.equal(h.sqlite.prepare('SELECT billing_review_reason FROM subscriptions').get().billing_review_reason, 'overdue_or_missing_token');
});

test('HTTP 400 card decline flags operator review and never extends or retries the debit', async t => {
  const h = setup(t); await subscription(h);
  const before = h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end;
  h.fetch(async (_url, options) => Response.json(approved(options, { result: { code: '800.100.152' } }), { status: 400 }));
  const { POST } = h.load('app/api/cron/billing/route');
  assert.equal((await POST(cron())).status, 200); await POST(cron());
  assert.equal(h.network.length, 1);
  const sub = h.sqlite.prepare('SELECT * FROM subscriptions').get();
  assert.equal(sub.current_period_end, before); assert.equal(sub.billing_review_reason, 'declined');
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders WHERE renewal_subscription_id IS NOT NULL').get().status, 'failed');
});

test('timeout is reconciled by reference without a second charge and clears review after success', async t => {
  const h = setup(t); await subscription(h);
  h.fetch(async () => { throw new Error('fixture timeout'); });
  const { POST } = h.load('app/api/cron/billing/route');
  assert.equal((await POST(cron())).status, 503);
  assert.equal(h.sqlite.prepare('SELECT billing_review_reason FROM subscriptions').get().billing_review_reason, 'uncertain');
  const renewal = h.sqlite.prepare('SELECT * FROM payment_orders WHERE renewal_subscription_id IS NOT NULL').get();
  h.sqlite.exec('UPDATE payment_orders SET created_at=unixepoch()-300,last_checked_at=NULL WHERE renewal_subscription_id IS NOT NULL');
  h.fetch(async (url, options) => {
    assert.equal(options.method, undefined); assert.equal(new URL(url).searchParams.get('merchantTransactionId'), renewal.id);
    return Response.json({ payments: [{ id: 'reconciled', merchantTransactionId: renewal.id, amount: '50.00', currency: 'ZAR', paymentType: 'DB', result: { code: '000.000.000' } }] });
  });
  assert.equal((await POST(cron())).status, 200);
  assert.equal(h.network.length, 2);
  assert.equal(h.sqlite.prepare('SELECT billing_review_reason FROM subscriptions').get().billing_review_reason, null);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders WHERE id=?').get(renewal.id).status, 'paid');
});

test('bad result currency is held for review and one failing debit does not stop another member', async t => {
  const h = setup(t); await subscription(h, 'first'); await subscription(h, 'second', 'bob');
  h.fetch(async (url, options) => {
    if (String(url).includes('token-first')) throw new Error('timeout');
    return Response.json(approved(options, { currency: 'USD' }));
  });
  assert.equal((await h.load('app/api/cron/billing/route').POST(cron())).status, 503);
  assert.equal(h.network.length, 2);
  assert.deepEqual(h.sqlite.prepare('SELECT billing_review_reason FROM subscriptions ORDER BY id').all().map(row => row.billing_review_reason), ['uncertain', 'mismatch']);
});

test('browser canceled and declined returns are informative hints and never grant membership', async t => {
  const h = setup(t); order(h); const route = h.load('app/api/checkout/return/route');
  for (const [code, state] of [['100.396.101', 'canceled'], ['800.100.152', 'failed'], ['000.000.000', 'pending'], ['100.396.104', 'review']]) {
    const response = await route.POST(new Request('https://community.example/api/checkout/return?space=greenspace-hub', { method: 'POST', body: new URLSearchParams({ 'result.code': code }) }));
    assert.equal(response.status, 303); assert.equal(new URL(response.headers.get('location')).searchParams.get('payment'), state);
  }
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n, 0);
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status, 'pending');
});

test('checkout status is session-scoped and stale pending payments have a finite review state', async t => {
  const h = setup(t); order(h); const { GET } = h.load('app/api/checkout/status/route');
  const request = () => new Request('https://community.example/api/checkout/status?space=greenspace-hub&order=monthly');
  h.user(null); assert.equal((await GET(request())).status, 401);
  h.user('bob'); assert.equal((await (await GET(request())).json()).status, 'unknown');
  h.user('alice'); assert.equal((await (await GET(request())).json()).status, 'pending');
  h.sqlite.exec('UPDATE payment_orders SET created_at=unixepoch()-601');
  assert.equal((await (await GET(request())).json()).status, 'review');
  await peachWebhook(h, { 'result.code': '100.396.101' });
  const result = await (await GET(request())).json(); assert.equal(result.status, 'failed'); assert.match(result.message, /canceled/);
});

test('iKhokha APP_KEY alias creates the annual ZAR checkout with failure and cancel returns', async t => {
  const h = setup(t); delete h.env.IKHOKHA_APP_ID;
  h.env.IKHOKHA_APP_KEY = 'alias-key'; h.env.IKHOKHA_ENTITY_ID = 'entity';
  h.fetch(async (_url, options) => {
    assert.equal(options.headers['IK-APPID'], 'alias-key');
    const payload = JSON.parse(options.body);
    assert.equal(payload.amount, 30000); assert.equal(payload.currency, 'ZAR');
    assert.match(payload.urls.failurePageUrl, /payment=failed&order=/);
    assert.match(payload.urls.cancelUrl, /payment=canceled&order=/);
    return Response.json({ responseCode: '00', paylinkID: 'link', paylinkUrl: 'https://securepay.ikhokha.com/pay/link' });
  });
  assert.equal((await h.load('lib/payment-server').createCheckout(checkoutRequest(), 'ikhokha')).status, 200);
});

test('billing runs with real workerd D1 and native credential bindings', { timeout: 60000 }, async () => {
  const bundle = await build({
    stdin: { contents: `
      import { POST } from './app/api/cron/billing/route.ts';
      globalThis.fetch = async (url, options) => {
        const data = new URLSearchParams(options.body);
        if (options.headers.Authorization !== 'Bearer native-token') throw Error('Wrong alias');
        return Response.json({id:'native-debit',merchantTransactionId:data.get('merchantTransactionId'),amount:'50.00',currency:'ZAR',paymentType:'DB',result:{code:'000.000.000'}});
      };
      export default {async fetch(request,env) { globalThis.testEnv=env; return POST(request); }};
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    plugins: [{ name: 'payment-context', setup(builder) {
      builder.onResolve({ filter: /^(@\/db|@\/auth|next\/cache|@opennextjs\/cloudflare)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: {
        '@/db': 'import {drizzle} from "drizzle-orm/d1"; export async function getDb(){return drizzle(globalThis.testEnv.DB);}',
        '@/auth': 'export async function auth(){return null;}',
        'next/cache': 'export function revalidatePath(){}',
        '@opennextjs/cloudflare': 'export async function getCloudflareContext(){return {env:globalThis.testEnv};}',
      }[args.path], loader: 'js', resolveDir: process.cwd() }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
    bindings: { CRON_SECRET: 'native-cron', PEACH_RECURRING_ENABLED: 'true', PEACH_ACCESS_TOKEN: 'native-token', PEACH_ENTITY_ID: 'entity' }, d1Databases: { DB: 'billing-test' } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      for (const statement of readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    await db.prepare("INSERT INTO users(id,name) VALUES('alice','Alice')").run();
    await db.prepare("INSERT INTO payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,status) VALUES('initial','alice','greenspace-hub','peach_payments','monthly',5000,'ZAR','paid')").run();
    await db.prepare("INSERT INTO subscriptions(id,user_id,space_slug,gateway,billing_cycle,status,current_period_end,registration_id) VALUES('initial','alice','greenspace-hub','peach_payments','monthly','active',unixepoch()-10,'token')").run();
    const url = 'https://test/api/cron/billing';
    assert.equal((await mf.dispatchFetch(url, { method: 'POST' })).status, 401);
    const call = () => mf.dispatchFetch(url, { method: 'POST', headers: { 'x-cron-secret': 'native-cron' } });
    const first = await call(); assert.equal(first.status, 200, await first.clone().text());
    assert.equal((await first.json()).submitted, 1);
    assert.equal((await (await call()).json()).submitted, 0);
    const sub = await db.prepare('SELECT current_period_end FROM subscriptions').first();
    assert.ok(sub.current_period_end > Date.now()/1000);
    assert.equal((await db.prepare("SELECT status FROM payment_orders WHERE renewal_subscription_id IS NOT NULL").first()).status, 'paid');
  } finally { await mf.dispose(); }
});
