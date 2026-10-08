import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/automation/news-fetcher.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseFeed, canonicalArticleUrl } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const item = (id, date = 'Wed, 07 Oct 2026 10:00:00 GMT') => `<item><title><![CDATA[Story ${id} &amp; business]]></title><link>https://techcentral.co.za/${id}/?utm_source=rss</link><pubDate>${date}</pubDate><description><![CDATA[<p>A technology development for African businesses.</p>]]></description></item>`;

test('RSS parser tolerates malformed XML, entities and incomplete items', () => {
  for (const xml of ['', '<rss>', '<item><title>broken', '<item><title>&#999999999999;</title></item>', '<!DOCTYPE rss SYSTEM "https://evil.test/entity">', 'x'.repeat(1_048_577)]) {
    assert.deepEqual(parseFeed(xml), []);
  }
  const parsed = parseFeed(`<rss>${item('one')}${item('two', 'Thu, 08 Oct 2026 10:00:00 GMT')}${item('one')}<item>broken</rss>`);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'Story two & business');
  assert.equal(parsed[0].link, 'https://techcentral.co.za/two/');
  assert.equal(parsed[0].description, 'A technology development for African businesses.');
  assert.equal(parseFeed(item('invalid', 'invalid')).length, 0);
  assert.equal(canonicalArticleUrl('javascript:alert(1)'), null);
  assert.equal(canonicalArticleUrl('https://user:password@example.com/'), null);
  assert.equal(canonicalArticleUrl('https://www.example.com/story?b=2&utm_campaign=x&a=1#top'), 'https://example.com/story?a=1&b=2');
});

test('native Workers publisher authorization, transactional D1 deduplication and failures', { timeout: 120000 }, async t => {
  const bundle = await build({
    stdin: { contents: `
      import { GET, POST } from './app/api/cron/publisher/route.ts';
      const summary = 'African businesses are adopting new technology that could improve how they work. This development offers entrepreneurs a useful opportunity to learn.\\n\\nBuilders across South Africa can consider how this approach fits their own challenges. How would you apply it in your business?';
      globalThis.fetch = async url => {
        if (globalThis.testMode === 'feeds-fail') return new Response('', {status:503});
        if (!String(url).includes('techcentral')) return new Response('', {status:503});
        return new Response(globalThis.testXml);
      };
      export default { async fetch(request, env) {
        globalThis.testMode = request.headers.get('x-test-mode');
        globalThis.testXml = request.headers.get('x-test-xml') || '';
        globalThis.paths = []; globalThis.aiCalls = 0;
        globalThis.testEnv = {...env, CRON_SECRET: globalThis.testMode === 'no-secret' ? '' : env.CRON_SECRET,
          AI: { async run(model, input) {
            globalThis.aiCalls++;
            if (model !== '@cf/meta/llama-3.1-8b-instruct' || !input.messages[0].content.includes('Zibuke Pulse')) throw Error('Wrong prompt');
            if (globalThis.testMode === 'ai-fail') throw Error('AI unavailable');
            return { response: globalThis.testMode === 'ai-invalid' ? 'unusable' : summary };
          } }
        };
        const response = await (request.method === 'GET' ? GET(request) : POST(request));
        response.headers.set('x-paths', JSON.stringify(globalThis.paths));
        response.headers.set('x-ai-calls', String(globalThis.aiCalls));
        return response;
      } };
    `, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    plugins: [{ name: 'publisher-context', setup(builder) {
      builder.onResolve({ filter: /^(@opennextjs\/cloudflare|next\/cache)$/ }, args => ({ path: args.path, namespace: 'publisher-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'publisher-context' }, args => ({
        contents: args.path === 'next/cache' ? 'export function revalidatePath(path) { globalThis.paths.push(path); }' : 'export async function getCloudflareContext() { return {env:globalThis.testEnv}; }', loader: 'js',
      }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
    bindings: { CRON_SECRET: 'publisher-fixture' }, d1Databases: { DB: 'publisher-test' },
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8').replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    const call = (headers = {}, method = 'POST', xml = item('one')) => mf.dispatchFetch('https://test/api/cron/publisher', { method, headers: { 'x-test-xml': xml, ...headers } });
    const auth = { authorization: 'Bearer publisher-fixture' };
    await t.test('missing, invalid and unconfigured secrets return 401', async () => {
      for (const headers of [{}, { authorization: 'Bearer wrong' }, { 'x-cron-secret': 'wrong' }, { ...auth, 'x-test-mode': 'no-secret' }]) {
        const response = await call(headers);
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('x-ai-calls'), '0');
      }
    });
    await t.test('publishes only the newest two, with the system author and attribution', async () => {
      const response = await call(auth, 'POST', item('old', 'Mon, 05 Oct 2026 10:00:00 GMT') + item('one') + item('two', 'Thu, 08 Oct 2026 10:00:00 GMT'));
      assert.equal(response.status, 200, await response.clone().text());
      const result = await response.json();
      assert.equal(result.success, true); assert.equal(result.articlesIngested, 2); assert.equal(result.postIds.length, 2);
      const rows = (await db.prepare('SELECT * FROM posts').all()).results;
      assert.equal(rows.length, 2);
      assert.ok(rows.every(row => row.user_id === 'system-zibuke-pulse' && row.space_id === 'space-welcome'));
      assert.match(rows[0].content, /🔗 \*Source: \[Story two & business\]\(https:\/\/techcentral.co.za\/two\/\)\*/);
      assert.ok(JSON.parse(response.headers.get('x-paths')).includes('/spaces'));
      assert.ok(JSON.parse(response.headers.get('x-paths')).includes('/'));
    });
    await t.test('repeat processing skips AI and posts; receipt survives deletion', async () => {
      let response = await call({ 'x-cron-secret': 'publisher-fixture' }, 'GET');
      assert.equal((await response.json()).articlesIngested, 0);
      assert.equal(response.headers.get('x-ai-calls'), '0');
      await db.prepare('DELETE FROM posts').run();
      response = await call(auth);
      assert.equal((await response.json()).articlesIngested, 0);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM published_articles').first()).n, 2);
    });
    await t.test('overlapping executions publish an article once', async () => {
      const responses = await Promise.all([call(auth, 'POST', item('race')), call(auth, 'POST', item('race'))]);
      const results = await Promise.all(responses.map(response => response.json()));
      assert.equal(results.reduce((sum, result) => sum + result.articlesIngested, 0), 1);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM posts').first()).n, 1);
    });
    await t.test('legacy attribution also prevents republication', async () => {
      await db.prepare('INSERT INTO posts(id,user_id,space_id,content) VALUES(?,?,?,?)').bind('legacy', 'system-zibuke-pulse', 'space-welcome', 'Source: https://techcentral.co.za/legacy/').run();
      assert.equal((await (await call(auth, 'POST', item('legacy'))).json()).articlesIngested, 0);
    });
    await t.test('feed and AI failures return 503 without recording a failed article', async () => {
      for (const mode of ['feeds-fail', 'ai-fail', 'ai-invalid']) {
        assert.equal((await call({ ...auth, 'x-test-mode': mode }, 'POST', item('retry'))).status, 503);
      }
      assert.equal((await (await call(auth, 'POST', item('retry'))).json()).articlesIngested, 1);
    });
    await t.test('a private default space cannot receive automated public posts', async () => {
      await db.prepare("UPDATE spaces SET privacy='private' WHERE id='space-welcome'").run();
      assert.equal((await call(auth, 'POST', item('private'))).status, 503);
    });
  } finally { await mf.dispose(); }
});

test('custom Worker preserves fetch and dispatches authenticated cron through OpenNext', async () => {
  const bundle = await build({ entryPoints: ['worker.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [{ name: 'generated-worker', setup(builder) {
    builder.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: 'generated', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const DOQueueHandler = {}, DOShardedTagCache = {}, BucketCachePurge = {}; export default { async fetch(request) { globalThis.publisherRequest = request; return new Response('', {status:globalThis.publisherStatus || 200}); } };`, loader: 'js' }));
  } }] });
  const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  try {
    assert.equal(typeof worker.fetch, 'function');
    await worker.scheduled({}, { CRON_SECRET: 'fixture' }, {});
    assert.equal(globalThis.publisherRequest.url, 'https://zibukecommunity.co.za/api/cron/publisher');
    assert.equal(globalThis.publisherRequest.headers.get('authorization'), 'Bearer fixture');
    assert.equal(globalThis.publisherRequest.method, 'POST');
    globalThis.publisherStatus = 503;
    await assert.rejects(worker.scheduled({}, { CRON_SECRET: 'fixture' }, {}), /503/);
    await assert.rejects(worker.scheduled({}, {}, {}), /not configured/);
  } finally { delete globalThis.publisherRequest; delete globalThis.publisherStatus; }
});
