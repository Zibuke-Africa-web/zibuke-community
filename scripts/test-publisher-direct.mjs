// Runs the real fetcher and publisher inside workerd, with isolated local D1.
// No production writes or paid AI calls. Use --fixtures for offline verification.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = process.argv.includes('--fixtures');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, contents: `
    import { publishNews } from './lib/automation/publisher';
    ${fixtures ? `globalThis.fetch = async url => new Response('<rss><channel><item><title>Local publisher verification</title><link>https://' + new URL(url).hostname + '/publisher-test</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>A local verification story for the community publisher.</description></item></channel></rss>');` : ''}
    export default { async fetch(request, env) {
      const result = await publishNews({ DB: env.DB, AI: { async run() { throw new Error('Direct test: verifying RSS fallback without paid AI'); } } });
      return Response.json(result, {status: result.success ? 200 : 503});
    } };
  ` },
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'publisher-direct-isolated' },
}));
try {
  const db = await mf.getD1Database('DB');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(file, migrations), 'utf8').replace(/^--.*$/gm, '');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const response = await mf.dispatchFetch('https://publisher.test/run');
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  assert.equal(response.status, 200, 'Publisher failed; inspect diagnostics above');
  assert.ok(result.articlesSaved > 0, 'Expected fresh posts in isolated D1');
  const rows = (await db.prepare(`SELECT p.id FROM posts p
    JOIN users u ON u.id=p.user_id JOIN spaces s ON s.id=p.space_id
    JOIN published_articles a ON a.post_id=p.id
    WHERE u.email='pulse@zibukecommunity.co.za' AND s.privacy='public' AND s.is_paywalled=0`).all()).results;
  assert.equal(rows.length, result.articlesSaved);
  console.log(`Verified ${rows.length} feed-visible posts and durable receipts in local workerd D1.`);
} finally { await mf.dispose(); }
