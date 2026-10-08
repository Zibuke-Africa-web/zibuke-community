import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/payments-harness.mjs';

test('all migrations apply with foreign keys and exact paid plan prices', t => {
  const h = setup(t);
  assert.deepEqual(h.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  const plans = h.sqlite.prepare('SELECT slug,currency,monthly_price_cents,annual_price_cents FROM spaces WHERE is_paywalled=1 ORDER BY slug').all();
  assert.equal(plans.length, 3);
  assert.deepEqual(plans.map(p => [p.slug,p.currency,p.monthly_price_cents,p.annual_price_cents]), [['builders-lab','USD',12000,70000],['bulletproof-venture','USD',4900,25000],['greenspace-hub','ZAR',5000,30000]]);
});

test('RSVPs are idempotent, owned by session, and cannot disclose paid room URLs', async t => {
  const h = setup(t); const actions = h.load('actions/events');
  h.sqlite.exec("INSERT INTO events(id,title,description,host_name,start_time,meet_url) VALUES ('open','Open','Workshop','Host',4102444800,'https://meet.example/open'); INSERT INTO events(id,space_id,title,description,host_name,start_time,meet_url) SELECT 'paid',id,'Paid','Workshop','Host',4102444800,'https://meet.example/private' FROM spaces WHERE slug='greenspace-hub'");
  h.user(null); assert.equal((await actions.rsvpEventAction('open')).ok, false);
  h.user('alice'); assert.equal((await actions.rsvpEventAction('open')).ok, true);
  assert.equal((await actions.rsvpEventAction('open')).ok, true);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM event_rsvps').get().n, 1);
  assert.equal((await actions.rsvpEventAction('paid')).ok, false);
  const list = await actions.getUpcomingEvents(); assert.equal(list.ok, true);
  assert.equal(list.events.find(e => e.id === 'paid').meetUrl, null);
  h.user('bob'); await actions.cancelRsvpAction('open');
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM event_rsvps').get().n, 1);
  h.user('alice'); await actions.cancelRsvpAction('open');
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM event_rsvps').get().n, 0);
});

test('South African midnight increments once, same-day activity cannot farm points, missed days reset', async t => {
  const h = setup(t); const { recordActivity } = h.load('lib/gamification');
  await recordActivity('alice', new Date('2026-10-01T21:59:59Z'));
  await Promise.all([recordActivity('alice', new Date('2026-10-01T22:00:01Z')), recordActivity('alice', new Date('2026-10-01T22:00:02Z'))]);
  let member = h.sqlite.prepare("SELECT * FROM users WHERE id='alice'").get();
  assert.equal(member.points, 10); assert.equal(member.current_streak, 2);
  await recordActivity('alice', new Date('2026-10-02T12:00:00Z'));
  assert.equal(h.sqlite.prepare("SELECT points FROM users WHERE id='alice'").get().points, 10);
  await recordActivity('alice', new Date('2026-10-05T12:00:00Z'));
  member = h.sqlite.prepare("SELECT * FROM users WHERE id='alice'").get();
  assert.equal(member.current_streak, 1); assert.equal(member.points, 10);
});

function addOrder(h, id = 'order1', gateway = 'ikhokha', user = 'alice') {
  h.sqlite.prepare('INSERT INTO payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,provider_id) VALUES (?,?,?,?,?,?,?,?)').run(id,user,'greenspace-hub',gateway,gateway === 'ikhokha' ? 'annual' : 'monthly',gateway === 'ikhokha' ? 30000 : 5000,'ZAR',`provider-${id}`);
  return h.db.select().from(h.load('db/schema').paymentOrders).then(rows => rows.find(row => row.id === id));
}

test('transactional settlement rejects replay across orders and duplicate deliveries never extend access', async t => {
  const h = setup(t); const { settleOrder } = h.load('lib/payment-server');
  const order = await addOrder(h); await settleOrder(order, 'txn');
  const end = h.sqlite.prepare("SELECT current_period_end FROM subscriptions WHERE id='order1'").get().current_period_end;
  await Promise.all([settleOrder(order,'txn'), settleOrder(order,'another-delivery')]);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n, 1);
  assert.equal(h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end, end);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM space_members').get().n, 1);
  const other = await addOrder(h, 'order2', 'ikhokha', 'bob'); await settleOrder(other, 'txn');
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM subscriptions WHERE user_id='bob'").get().n, 0);
  assert.equal(h.sqlite.prepare("SELECT status FROM payment_orders WHERE id='order2'").get().status, 'pending');
});

test('iKhokha signature, payment reference and amount are verified before granting annual access', async t => {
  const h = setup(t); await addOrder(h);
  const { hmacHex, ikSigningPayload } = h.load('lib/payments'); const { POST } = h.load('app/api/webhooks/ikhokha/route');
  async function send(body, valid = true) {
    const raw = JSON.stringify(body);
    const signature = valid ? await hmacHex(h.env.IKHOKHA_APP_SECRET, ikSigningPayload('/api/webhooks/ikhokha', raw)) : '0'.repeat(64);
    return POST(new Request('https://community.example/api/webhooks/ikhokha', { method:'POST', body:raw, headers:{ 'ik-appid': h.env.IKHOKHA_APP_ID, 'ik-sign':signature } }));
  }
  assert.equal((await send({ paylinkID:'provider-order1', status:'SUCCESS' },false)).status,401);
  assert.equal((await send({ paylinkID:'provider-order1', status:'SUCCESS', amount:1 })).status,400);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n,0);
  assert.equal((await send({ paylinkID:'provider-order1', status:'SUCCESS' })).status,200);
  assert.equal((await send({ paylinkID:'provider-order1', status:'SUCCESS' })).status,200);
  const end = h.sqlite.prepare('SELECT current_period_end FROM subscriptions').get().current_period_end;
  assert.ok(Math.abs(end - Date.now()/1000 - 365*86400) < 5);
});

test('Peach signature freshness and exact currency protect recurring activation', async t => {
  const h = setup(t); await addOrder(h,'monthly','peach_payments');
  const { hmacHex } = h.load('lib/payments'); const { POST } = h.load('app/api/webhooks/peach/route');
  async function send(overrides = {}, offset = 0) {
    const raw = new URLSearchParams({ merchantTransactionId:'monthly',id:'peach-txn',checkoutId:'provider-monthly',amount:'50.00',currency:'ZAR',paymentType:'DB','result.code':'000.100.110',registrationId:'registration',...overrides }).toString();
    const timestamp = String(Math.floor(Date.now()/1000)+offset);
    const signature = await hmacHex(h.env.PEACH_WEBHOOK_SECRET,`${timestamp}.delivery.https://community.example/api/webhooks/peach.${raw}`);
    return POST(new Request('https://community.example/api/webhooks/peach',{method:'POST',body:raw,headers:{'x-webhook-timestamp':timestamp,'x-webhook-id':'delivery','x-webhook-signature':signature}}));
  }
  assert.equal((await send({},-600)).status,401);
  assert.equal((await send({currency:'USD'})).status,400);
  assert.equal((await send()).status,200);
  assert.equal((await send()).status,200);
  assert.equal(h.sqlite.prepare('SELECT registration_id FROM subscriptions').get().registration_id,'registration');
  assert.equal((await send({paymentType:'RF',id:'refund'})).status,200);
  assert.equal((await send()).status,200);
  assert.equal(h.sqlite.prepare('SELECT status FROM subscriptions').get().status,'expired');
  assert.equal(h.sqlite.prepare('SELECT status FROM payment_orders').get().status,'refunded');
});

test('canceled memberships retain paid time, expire correctly, and private metadata stays hidden', async t => {
  const h = setup(t); const { settleOrder } = h.load('lib/payment-server');
  await settleOrder(await addOrder(h,'monthly','peach_payments'),'txn','registration');
  const { getSpaceAccess } = h.load('lib/space-access');
  assert.equal((await getSpaceAccess('greenspace-hub','bob')).allowed,false);
  await h.load('actions/subscriptions').cancelSubscriptionAction('monthly');
  assert.equal((await getSpaceAccess('greenspace-hub','alice')).allowed,true);
  h.sqlite.exec("UPDATE subscriptions SET current_period_end=1");
  assert.equal((await getSpaceAccess('greenspace-hub','alice')).allowed,false);
  h.sqlite.exec("UPDATE spaces SET privacy='private' WHERE slug='greenspace-hub'");
  assert.equal((await getSpaceAccess('greenspace-hub','bob')).space,null);
});

test('monthly billing claims each period once and cancellation stops new charges', async t => {
  const h = setup(t); const { settleOrder } = h.load('lib/payment-server');
  await settleOrder(await addOrder(h,'monthly','peach_payments'),'initial','registration');
  h.sqlite.exec("UPDATE subscriptions SET current_period_end=unixepoch()-5");
  h.fetch(async (url, options) => {
    assert.equal(options.redirect,'follow');
    assert.ok(String(url).includes('/registrations/registration/payments'));
    const body = new URLSearchParams(options.body);
    return Response.json({ id:'renewal',merchantTransactionId:body.get('merchantTransactionId'),amount:'50.00',currency:'ZAR',paymentType:'DB',result:{code:'000.000.000'} });
  });
  const { POST } = h.load('app/api/cron/billing/route');
  const request = () => new Request('https://community.example/api/cron/billing',{method:'POST',headers:{authorization:'Bearer fixture-cron'}});
  assert.equal((await POST(new Request('https://community.example/api/cron/billing',{method:'POST'}))).status,401);
  assert.equal((await POST(request())).status,200);
  assert.equal((await POST(request())).status,200);
  assert.equal(h.network.length,1);
  h.sqlite.exec("UPDATE subscriptions SET status='canceled',current_period_end=unixepoch()-5");
  await POST(request()); assert.equal(h.network.length,1);
});

test('checkout fixes price and user server-side, blocks duplicate payment and unsupported currency', async t => {
  const h = setup(t);
  Object.assign(h.env, { PEACH_CLIENT_ID:'client',PEACH_CLIENT_SECRET:'secret',PEACH_MERCHANT_ID:'merchant' });
  const { createCheckout } = h.load('lib/payment-server');
  const request = (body = {}, origin = 'https://community.example') => new Request('https://community.example/api/checkout/peach',{method:'POST',body:JSON.stringify({spaceSlug:'greenspace-hub',...body}),headers:{origin}});
  h.user(null); assert.equal((await createCheckout(request(),'peach_payments')).status,401);
  h.user('alice'); assert.equal((await createCheckout(request({},'https://evil.example'),'peach_payments')).status,403);
  assert.equal((await createCheckout(request({spaceSlug:'builders-lab'}),'peach_payments')).status,503);
  h.fetch(async (url, options) => {
    assert.equal(options.redirect,'follow');
    if (url.includes('/oauth/token')) return Response.json({access_token:'test-token'});
    const payload = JSON.parse(options.body);
    assert.equal(payload.amount,50); assert.equal(payload.currency,'ZAR'); assert.equal(payload.createRegistration,true);
    return Response.json({checkoutId:'checkout',redirectUrl:'https://testsecure.peachpayments.com/checkout/test'});
  });
  const response = await createCheckout(request({amount:1,currency:'USD',userId:'bob'}),'peach_payments');
  assert.equal(response.status,200);
  const order = h.sqlite.prepare('SELECT * FROM payment_orders').get();
  assert.equal(order.amount_cents,5000); assert.equal(order.user_id,'alice');
  assert.equal((await createCheckout(request(),'peach_payments')).status,409);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM subscriptions').get().n,0);
  assert.equal(h.network.length,2);
});

test('checkout rejects unexpected provider redirect hosts', async t => {
  const h = setup(t);
  const { checkedCheckoutUrl } = h.load('lib/payment-server');
  for (const url of ['https://evil.example/','javascript:alert(1)','https://user:pass@securepay.ikhokha.com/']) {
    assert.throws(() => checkedCheckoutUrl(url,'ikhokha',h.env));
  }
});
