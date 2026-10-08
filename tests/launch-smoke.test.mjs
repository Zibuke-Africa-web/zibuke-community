import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// HTTP integration smoke: real app handlers/pages and workerd D1. Identity,
// Next navigation primitives, feeds and paid providers are deterministic fixtures.
test('launch smoke: platform flows through HTTP, rendered UI and native D1', { timeout: 120000 }, async t => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToString } from 'react-dom/server';
    import { middleware, config } from './middleware.ts';
    import FeedPage from './app/(platform)/feed/page.tsx';
    import DirectoryPage from './app/(platform)/directory/page.tsx';
    import SpacesPage from './app/spaces/page.tsx';
    import HealthPage from './app/(platform)/(admin)/health/page.tsx';
    import { GET as health } from './app/api/admin/health/route.ts';
    import { POST as manualRun } from './app/api/admin/health/run/route.ts';
    import { POST as publisher } from './app/api/cron/publisher/route.ts';
    import { POST as billing } from './app/api/cron/billing/route.ts';
    import { POST as webhook } from './app/api/webhooks/peach/route.ts';
    import { CheckoutResult } from './components/checkout-result.tsx';
    import NotFound from './app/not-found.tsx';
    const rss = '<rss><channel><item><title>African builders</title><link>https://techcentral.co.za/launch-story/</link><pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate><description>African builders are sharing ideas and growing their businesses.</description></item></channel></rss>';
    globalThis.fetch = async url => String(url).includes('techcentral.co.za/feed/') ? new Response(rss) : new Response('',{status:503});
    export default { async fetch(request, env) {
      globalThis.testUser = request.headers.get('x-fixture-user');
      globalThis.testEnv = {...env, AI:{run:async()=>({response:'African builders are sharing ideas to help businesses grow. This creates opportunities for collaboration across the continent.\\n\\nEntrepreneurs in South Africa can connect with peers and explore these ideas together. What would help your business collaborate more effectively?'})},
        ZIBUKE_BUCKET:{head:async()=>null}, WORKER_SELF_REFERENCE:{fetch:async(url,options)=>{
          if (!String(url).startsWith('https://zibukecommunity.co.za/api/cron/') || options.headers.authorization !== 'Bearer launch-cron-secret') throw Error('Invalid internal dispatch');
          return Response.json({success:true,articlesIngested:0,submitted:0,skipped:String(url).endsWith('/billing')});
        }}
      };
      const url = new URL(request.url), path = url.pathname;
      const protectedPath = config.matcher.some(pattern => { const root=pattern.replace('/:path*',''); return path===root || pattern.endsWith('/:path*') && path.startsWith(root+'/'); });
      if(protectedPath) { const result = await middleware({nextUrl:url}); if(result.status!==204) return result; }
      try {
        if(path==='/api/admin/health') return health();
        if(path==='/api/admin/health/run') return manualRun(request);
        if(path==='/api/cron/publisher') return publisher(request);
        if(path==='/api/cron/billing') return billing(request);
        if(path==='/api/webhooks/peach') return webhook(request);
        let element;
        if(path==='/feed') element=await FeedPage({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
        else if(path==='/directory') element=await DirectoryPage({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
        else if(path==='/spaces') element=await SpacesPage();
        else if(path==='/health') element=await HealthPage();
        else if(path.startsWith('/checkout/')) element=await CheckoutResult({params:Object.fromEntries(url.searchParams),cancelled:path.endsWith('/cancelled')});
        else return new Response(renderToString(React.createElement(NotFound)),{status:404,headers:{'content-type':'text/html'}});
        return new Response(renderToString(element),{headers:{'content-type':'text/html'}});
      } catch(error) { if(error.location)return Response.redirect(new URL(error.location,url),307); throw error; }
    }};
  `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    plugins: [{ name: 'launch-context', setup(builder) {
      builder.onResolve({ filter: /^(@\/db|@\/auth|@\/app\/actions|next\/cache|next\/navigation|next\/server|next\/link|next\/image|server-only|@opennextjs\/cloudflare)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
        '@/db': 'import {drizzle} from "drizzle-orm/d1"; export async function getDb(){return drizzle(globalThis.testEnv.DB);}',
        '@/auth': 'export async function auth(){return globalThis.testUser ? {user:{id:globalThis.testUser,role:"admin"}} : null;}',
        '@/app/actions': 'export async function uploadMedia(){throw Error("Unexpected upload");}',
        'next/cache': 'export function revalidatePath(){}',
        'next/navigation': 'export function useRouter(){return {refresh(){}};} export function redirect(location){throw {location};}',
        'next/server': 'export const NextResponse={next:()=>new Response(null,{status:204}),redirect:url=>Response.redirect(url,307)};',
        'next/link': 'import React from "react"; export default function Link({children,...props}){return React.createElement("a",props,children);}',
        'next/image': 'import React from "react"; export default function Image({src,alt}){return React.createElement("img",{src,alt});}',
        'server-only': '',
        '@opennextjs/cloudflare': 'export async function getCloudflareContext(){return {env:globalThis.testEnv};}',
      }[args.path], loader: 'js', resolveDir: process.cwd() }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
    bindings: { CRON_SECRET: 'launch-cron-secret', PEACH_RECURRING_ENABLED: 'false', PEACH_ACCESS_TOKEN: 'launch-card-secret', PEACH_ENTITY_ID: 'launch-entity-secret', PEACH_WEBHOOK_SECRET: 'launch-webhook-secret', PAYMENTS_APP_URL: 'https://launch.test', IKHOKHA_APP_KEY: 'launch-app-key', IKHOKHA_APP_SECRET: 'launch-app-secret' }, d1Databases: { DB: 'launch-smoke' } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      for (const statement of readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').replace(/^--.*$/gm, '').split(';').map(value=>value.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    await db.prepare("INSERT INTO users(id,name,role,location,location_city) VALUES('member','Cape Member','member','Cape Town','Cape Town'),('other','Durban Member','member','Durban','Durban'),('operator','Launch Operator','admin','','')").run();
    const call = (path, user, options={}) => mf.dispatchFetch('https://launch.test'+path, {redirect:'manual',...options,headers:{...(user?{'x-fixture-user':user}:{}),...options.headers}});
    await t.test('1. public Spaces loads, platform routes require a session, and authenticated feed renders', async()=>{
      assert.equal((await call('/spaces')).status,200);
      for(const path of ['/feed','/directory','/health','/checkout/success']) {
        const response=await call(path); assert.equal(response.status,307); assert.equal(new URL(response.headers.get('location')).pathname,'/login');
      }
      const response=await call('/feed','member'); assert.equal(response.status,200); assert.match(await response.text(),/Be the first to say hello/);
      const missing=await call('/does-not-exist'); assert.equal(missing.status,404); assert.match(await missing.text(),/Return to Community Feed/);
    });
    await t.test('2. directory location pills filter D1 records and empty state resets all locations', async()=>{
      const cape=await (await call('/directory?city=Western+Cape','member')).text();
      assert.match(cape,/Cape Member/); assert.doesNotMatch(cape,/Durban Member/); assert.match(cape,/Cape Town \(Local\)/);
      const empty=await (await call('/directory?city=Nowhere','member')).text();
      assert.match(empty,/No members found in this area yet/); assert.match(empty,/href="\/directory"/);
      const all=await (await call('/directory','member')).text(); assert.match(all,/Cape Member/); assert.match(all,/Durban Member/);
    });
    await t.test('3. publisher persists a system bot post, deduplicates repeated RSS, and exposes it in the feed', async()=>{
      assert.equal((await call('/api/cron/publisher',undefined,{method:'POST'})).status,401);
      const options={method:'POST',headers:{'x-cron-secret':'launch-cron-secret'}};
      const first=await call('/api/cron/publisher',undefined,options); assert.equal(first.status,200,await first.clone().text());
      assert.equal((await first.json()).articlesIngested,1);
      assert.equal((await (await call('/api/cron/publisher',undefined,options)).json()).articlesIngested,0);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM posts').first()).n,1);
      const feed=await (await call('/feed','member')).text(); assert.match(feed,/Zibuke Pulse/); assert.match(feed,/African builders/);
      const run=await db.prepare("SELECT status FROM service_runs WHERE service='publisher'").first(); assert.equal(run.status,'success');
    });
    await t.test('4. webhook verification rejects forged signatures and settles exactly once', async()=>{
      await db.prepare("INSERT INTO payment_orders(id,user_id,space_slug,gateway,billing_cycle,amount_cents,currency,provider_id) VALUES('launch-order','member','greenspace-hub','peach_payments','monthly',5000,'ZAR','launch-checkout')").run();
      const raw=new URLSearchParams({merchantTransactionId:'launch-order',id:'launch-payment',checkoutId:'launch-checkout',amount:'50.00',currency:'ZAR',paymentType:'DB',registrationId:'launch-registration','result.code':'000.000.000'}).toString();
      const timestamp=String(Math.floor(Date.now()/1000));
      const signature=createHmac('sha256','launch-webhook-secret').update(timestamp+'.launch-delivery.https://launch.test/api/webhooks/peach.'+raw).digest('hex');
      const options={method:'POST',body:raw,headers:{'x-webhook-id':'launch-delivery','x-webhook-timestamp':timestamp,'x-webhook-signature':'0'.repeat(64)}};
      assert.equal((await call('/api/webhooks/peach',undefined,options)).status,401);
      options.headers['x-webhook-signature']=signature;
      assert.equal((await call('/api/webhooks/peach',undefined,options)).status,200);
      assert.equal((await call('/api/webhooks/peach',undefined,options)).status,200);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM subscriptions').first()).n,1);
      assert.match(await (await call('/checkout/success?space=greenspace-hub&order=launch-order','member')).text(),/Payment confirmed/);
      assert.doesNotMatch(await (await call('/checkout/success?space=greenspace-hub&order=launch-order','other')).text(),/Payment confirmed/);
      assert.equal((await call('/api/cron/billing',undefined,{method:'POST',headers:{'x-cron-secret':'wrong'}})).status,401);
      const billing=await call('/api/cron/billing',undefined,{method:'POST',headers:{'x-cron-secret':'launch-cron-secret'}}); assert.equal(billing.status,200);
      assert.equal((await db.prepare("SELECT status FROM service_runs WHERE service='billing'").first()).status,'disabled');
    });
    await t.test('5. health denies guests/non-admins, allows admins, and never exposes credentials', async()=>{
      assert.equal((await call('/api/admin/health')).status,401);
      assert.equal((await call('/api/admin/health','member')).status,403,'even a fixture session claiming admin must match D1 role');
      assert.equal((await call('/health','member')).status,307);
      const response=await call('/api/admin/health','operator'); assert.equal(response.status,200);
      const raw=await response.text(); for(const secret of ['launch-cron-secret','launch-card-secret','launch-app-secret','launch-webhook-secret']) assert.ok(!raw.includes(secret));
      const health=JSON.parse(raw); assert.deepEqual(health.bindings,{d1:true,r2:true,ai:true}); assert.equal(health.activeSubscriptions,1); assert.ok(health.lastArticle); assert.equal(health.recurringEnabled,false);
      const page=await call('/health','operator'); assert.equal(page.status,200); const html=await page.text(); assert.match(html,/Run Publisher Now/); assert.match(html,/Run Billing Check Now/); assert.doesNotMatch(html,/launch-cron-secret/);
      const run={method:'POST',headers:{origin:'https://launch.test','content-type':'application/json'},body:JSON.stringify({service:'billing'})};
      assert.equal((await call('/api/admin/health/run',undefined,run)).status,401);
      assert.equal((await call('/api/admin/health/run','member',run)).status,403);
      assert.equal((await call('/api/admin/health/run','operator',{...run,headers:{origin:'https://evil.test'}})).status,403);
      const manual=await call('/api/admin/health/run','operator',run); assert.equal(manual.status,200); assert.match((await manual.json()).message,/disabled/);
      await db.prepare("UPDATE users SET role='member' WHERE id='operator'").run();
      assert.equal((await call('/api/admin/health','operator')).status,403);
    });
  } finally { await mf.dispose(); }
});
