import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.exec("INSERT INTO users(id,name) VALUES ('alice','Alice'),('bob','Bob')");
  let batchQueue = Promise.resolve();
  const d1 = {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...params) }; },
        async raw() { const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return stmt.all(...params); },
        async run() { return { success: true, meta: sqlite.prepare(sql).run(...params) }; },
      };
    },
    batch(statements) {
      const work = batchQueue.then(async () => {
        sqlite.exec('BEGIN');
        try { const results = []; for (const stmt of statements) results.push(await stmt.all()); sqlite.exec('COMMIT'); return results; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      });
      batchQueue = work.catch(() => {}); return work;
    },
  };
  const db = require('drizzle-orm/d1').drizzle(d1);
  let user = 'alice';
  const env = { PAYMENTS_APP_URL: 'https://community.example', PEACH_WEBHOOK_SECRET: 'fixture-peach', IKHOKHA_APP_ID: 'fixture-app', IKHOKHA_APP_SECRET: 'fixture-ik', CRON_SECRET: 'fixture-cron', PEACH_RECURRING_ENABLED: 'true', PEACH_ENTITY_ID: 'fixture-entity', PEACH_CARD_ACCESS_TOKEN: 'fixture-token' };
  const cache = new Map();
  const network = [];
  const processEnv = { BOT_POST_SECRET: 'fixture-bot-secret' };
  const paths = [];
  let dbCalls = 0;
  let fetchImpl = async () => { throw new Error('Unexpected network request'); };
  const mocks = {
    '@/db': { getDb: async () => { dbCalls++; return db; } },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
    '@/auth': { auth: async () => user ? { user: { id: user } } : null },
    'next/cache': { revalidatePath: path => paths.push(path) },
    '@opennextjs/cloudflare': { getCloudflareContext: async () => ({ env: { ...env, DB: d1 } }) },
  };
  function load(path) {
    if (!/\.tsx?$/.test(path)) path += '.ts';
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(source, { exports, crypto, URL, URLSearchParams, Date, Request, Response, TextEncoder, TextDecoder, AbortSignal, process: { env: processEnv },
      fetch: async (...args) => { network.push(args); return fetchImpl(...args); },
      require: name => mocks[name] ?? (name.startsWith('@/') ? load(name.slice(2)) : require(name)),
    }, { filename: path });
    return exports;
  }
  return { sqlite, db, load, env, network, processEnv, paths, dbCalls: () => dbCalls, user: value => { user = value; }, fetch: impl => { fetchImpl = impl; } };
}

function request(body = { content: 'A public update for our community.' }, headers = { authorization: 'Bearer fixture-bot-secret' }) {
  return new Request('https://community.example/api/internal/bot-post', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('bot rejects missing, wrong and unconfigured secrets before accessing D1', async t => {
  const h = setup(t); const { POST } = h.load('app/api/internal/bot-post/route');
  for (const headers of [{}, { authorization: 'Bearer wrong' }, { 'x-bot-secret': 'wrong' }, { authorization: 'fixture-bot-secret' }]) {
    const result = await POST(request(undefined, headers));
    assert.equal(result.status, 401); assert.deepEqual(await result.json(), { error: 'Unauthorized' });
  }
  delete h.processEnv.BOT_POST_SECRET;
  assert.equal((await POST(request())).status, 401);
  assert.equal(h.dbCalls(), 0);
});

test('bot creates a system author and attributed post, defaults general to welcome and refreshes feeds', async t => {
  const h = setup(t); const { POST } = h.load('app/api/internal/bot-post/route');
  const response = await POST(request({ content: 'Technology connects our community.', title: 'Headline', category: 'Tech', sourceUrl: 'https://example.com/article', authorAvatar: 'https://example.com/bot.svg' }));
  assert.equal(response.status, 201);
  const result = await response.json(); assert.equal(result.success, true);
  const post = h.sqlite.prepare('SELECT * FROM posts WHERE id=?').get(result.postId);
  assert.equal(post.space_id, 'space-welcome');
  assert.equal(post.user_id, 'system-zibuke-pulse');
  assert.equal(post.content, 'Headline\n\nCategory: Tech\n\nTechnology connects our community.\n\nSource: https://example.com/article');
  assert.ok(Math.abs(Date.now()/1000-post.created_at) < 5);
  const author = h.sqlite.prepare('SELECT * FROM users WHERE id=?').get(post.user_id);
  assert.equal(author.name, 'Zibuke Pulse'); assert.equal(author.email, 'pulse@zibukecommunity.co.za'); assert.equal(author.role, 'system');
  assert.equal(author.profile_picture_url, 'https://example.com/bot.svg');
  for (const path of ['/', '/feed', '/spaces', '/spaces/welcome']) assert.ok(h.paths.includes(path));
  const feed = await h.load('actions/spaces').getCommunityFeed();
  assert.equal(feed.data.posts[0].id, post.id);
  assert.equal(feed.data.posts[0].author.name, 'Zibuke Pulse');
});

test('bot supports custom-secret headers and target spaces; repeated provisioning reuses one identity', async t => {
  const h = setup(t); const { POST } = h.load('app/api/internal/bot-post/route');
  h.sqlite.exec("INSERT INTO spaces(id,slug,name) VALUES ('tech','tech','Tech')");
  const results = await Promise.all([1,2].map(() => POST(request({ content: 'Another technology update.', spaceSlug: 'tech', authorName: 'Zibuke Pulse Tech' }, { 'x-bot-secret': 'fixture-bot-secret' }))));
  for (const result of results) assert.equal(result.status, 201);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM users WHERE email='pulse@zibukecommunity.co.za'").get().n, 1);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM posts WHERE space_id='tech'").get().n, 2);
});

test('bot refuses unsafe payloads, oversized bodies, restricted spaces and user identity takeover', async t => {
  const h = setup(t); const { POST } = h.load('app/api/internal/bot-post/route');
  for (const payload of [null, [], {}, { content: 10 }, { content: 'short' }, { content: 'x'.repeat(5001) },
    { content: 'Valid content here', title: 4 }, { content: 'Valid content here', sourceUrl: 'javascript:alert(1)' },
    { content: 'Valid content here', authorAvatar: '<svg onload="bad" />' }, { content: 'Valid content here', authorAvatar: 'data:image/svg+xml,bad' },
    { content: 'Valid content here', sourceUrl: 'https://user:pass@example.com' }, { content: 'Valid content here', spaceSlug: '../secret' },
    { content: 'x'.repeat(5000), title: 'Too much combined text' }]) assert.equal((await POST(request(payload))).status, 400);
  assert.equal((await POST(new Request('https://test', { method: 'POST', headers: { authorization: 'Bearer fixture-bot-secret', 'content-type': 'application/json' }, body: 'x'.repeat(65537) }))).status, 400);
  assert.equal((await POST(request(undefined, { authorization: 'Bearer fixture-bot-secret', 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await POST(request({ content: 'No missing destination', spaceSlug: 'unknown' }))).status, 404);
  h.sqlite.exec("UPDATE spaces SET privacy='private' WHERE slug='welcome'");
  assert.equal((await POST(request())).status, 404);
  h.sqlite.exec("UPDATE spaces SET privacy='public',is_paywalled=1 WHERE slug='welcome'");
  assert.equal((await POST(request())).status, 404);
  h.sqlite.exec("UPDATE spaces SET is_paywalled=0 WHERE slug='welcome'; UPDATE users SET email='pulse@zibukecommunity.co.za' WHERE id='alice'");
  assert.equal((await POST(request())).status, 409);
  assert.equal(h.sqlite.prepare("SELECT role FROM users WHERE id='alice'").get().role, 'member');
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM posts').get().n, 0);
});

test('bot non-POST handlers return 405 with an explicit Allow header', t => {
  const h = setup(t); const route = h.load('app/api/internal/bot-post/route');
  for (const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS']) {
    const response = route[method](); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST');
  }
  assert.equal(h.dbCalls(), 0);
});

test('directory renders national fallback for unset profiles/guests and personalized local pills for saved cities', async t => {
  const h = setup(t); const Page = h.load('app/(platform)/directory/page.tsx').default;
  for (const user of [null, 'alice']) {
    h.user(user);
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.ok(html.includes('Find your people and trusted partners across South Africa.'));
    assert.ok(!html.includes('Secunda (Local)'));
  }
  h.user('alice');
  for (const city of ['Secunda','Johannesburg','Durban']) {
    h.sqlite.prepare('UPDATE users SET location=? WHERE id=?').run(city, 'alice');
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.ok(html.includes(`in ${city} and across South Africa.`));
    assert.ok(html.includes(`${city} (Local)`));
    for (const province of ['Gauteng','Western Cape','Mpumalanga','KwaZulu-Natal']) assert.ok(html.includes(province));
  }
});

test('directory location, province, category and escaped search filters select real matching members', async t => {
  const h = setup(t); const { readDirectory } = h.load('lib/directory');
  h.sqlite.exec(`UPDATE users SET location='Johannesburg, Gauteng',business_category='Consulting',business_name='100% Local' WHERE id='alice';
    UPDATE users SET location='Durban, KwaZulu-Natal',business_category='Retail' WHERE id='bob';
    INSERT INTO users(id,name,location,role) VALUES ('cape','Cape member','Cape Town','member'),('small','Small town','A Town, Gauteng','member'),('bot','Pulse','Johannesburg','system');`);
  const ids = result => Array.from(result.members, member => member.id);
  assert.deepEqual(ids(await readDirectory(h.db, 'alice', { city: 'Johannesburg' })), ['alice']);
  assert.deepEqual(ids(await readDirectory(h.db, 'alice', { city: 'Gauteng' })), ['alice','small']);
  assert.deepEqual(ids(await readDirectory(h.db, 'alice', { city: 'Western Cape' })), ['cape']);
  assert.deepEqual(ids(await readDirectory(h.db, 'alice', { city: 'KwaZulu-Natal', category: 'Retail' })), ['bob']);
  assert.equal((await readDirectory(h.db, 'alice', { city: 'KwaZulu-Natal', category: 'Consulting' })).members.length, 0);
  assert.deepEqual(ids(await readDirectory(h.db, 'alice', { q: '%' })), ['alice']);
  assert.equal((await readDirectory(h.db, 'alice', { city: "' OR 1=1--" })).members.length, 0);
  const all = await readDirectory(h.db, 'alice', {});
  assert.equal(all.city, ''); assert.equal(all.members.length, 4);
  h.sqlite.exec("UPDATE users SET location=null,location_city='Pretoria' WHERE id='alice'");
  assert.equal((await readDirectory(h.db, 'alice', {})).localCity, 'Pretoria');
});

