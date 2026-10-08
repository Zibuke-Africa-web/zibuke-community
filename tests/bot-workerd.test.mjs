import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('bot ingestion uses process.env and persists via real workerd D1', { timeout: 60000 }, async () => {
  const bundle = await build({
    stdin: { contents: `
      import { POST } from './app/api/internal/bot-post/route.ts';
      export default { async fetch(request, env) { globalThis.testEnv = env; return POST(request); } };
    `, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    plugins: [{ name: 'test-context', setup(builder) {
      builder.onResolve({ filter: /^(@\/db|next\/cache)$/ }, args => ({ path: args.path, namespace: 'test-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-context' }, args => ({
        contents: args.path === '@/db' ? 'import { drizzle } from "drizzle-orm/d1"; export async function getDb() { return drizzle(globalThis.testEnv.DB); }' : 'export function revalidatePath() {}',
        loader: 'js', resolveDir: process.cwd(),
      }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
    bindings: { BOT_POST_SECRET: 'workerd-bot-fixture' }, d1Databases: { DB: 'bot-ingestion-test' },
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8').replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    const url = 'https://test/api/internal/bot-post';
    assert.equal((await mf.dispatchFetch(url, { method: 'POST', body: '{}' })).status, 401);
    const response = await mf.dispatchFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer workerd-bot-fixture' }, body: JSON.stringify({ content: 'A real Workers runtime community update.' }) });
    assert.equal(response.status, 201, await response.clone().text());
    const { postId } = await response.json();
    const post = await db.prepare('SELECT user_id,space_id,content FROM posts WHERE id=?').bind(postId).first();
    assert.equal(post.user_id, 'system-zibuke-pulse');
    assert.equal(post.space_id, 'space-welcome');
    assert.equal(post.content, 'A real Workers runtime community update.');
  } finally { await mf.dispose(); }
});
