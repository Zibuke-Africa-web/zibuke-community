import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Bundle the actual handlers. Only session/context/NextResponse are injected;
// fetch, Request, redirects and AbortSignal execute in real workerd.
test('all three Groq handlers execute using real workerd fetch', { timeout: 60000 }, async () => {
  const bundle = await build({
    stdin: { contents: `
      import { GET } from './app/api/groq-check/route.ts';
      import { POST as cohost } from './app/api/cohost/chat/route.ts';
      import { POST as botanist } from './app/api/botanist/diagnose/route.ts';
      export default { async fetch(request, env) {
        globalThis.testEnv = env;
        const path = new URL(request.url).pathname;
        if (path === '/redirect-negative-control') {
          try { await fetch('https://api.groq.com/test', { redirect: 'error' }); }
          catch { return new Response('rejected'); }
          return new Response('unexpected success', { status: 500 });
        }
        return path.includes('groq-check') ? GET(request) : path.includes('cohost') ? cohost(request) : botanist(request);
      } }`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    define: { 'process.env': '{}' },
    plugins: [{ name: 'test-context', setup(builder) {
      builder.onResolve({ filter: /^(@opennextjs\/cloudflare|@\/auth|@\/lib\/space-access|next\/server)$/ }, args => ({ path: args.path, namespace: 'test-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-context' }, args => ({ contents:
        args.path === '@/lib/space-access' ? 'export async function getSpaceAccess() { return { allowed: true }; }' :
        args.path === '@/auth' ? 'export async function auth() { return { user: { id: "test-member", role: "admin" } }; }' :
        args.path === 'next/server' ? 'export const NextResponse = Response;' :
        'export async function getCloudflareContext() { return { env: globalThis.testEnv }; }', loader: 'js' }));
    } }],
  });
  const calls = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-09-28', compatibilityFlags: ['nodejs_compat'],
    bindings: { GROQ_API_KEY: 'test-only', GROQ_TEXT_MODEL: 'openai/gpt-oss-20b' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(request.headers.get('Authorization'), 'Bearer test-only');
      const payload = await request.json();
      calls.push(payload);
      const content = payload.response_format ? JSON.stringify({ reply: 'Check drainage.', isServiceRecommended: false }) : 'OK';
      return Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });
    },
  }));
  try {
    const negative = await mf.dispatchFetch('https://test/redirect-negative-control');
    assert.equal(await negative.text(), 'rejected');
    const health = await mf.dispatchFetch('https://test/api/groq-check?secret=zibuke-check');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    assert.equal(health.headers.get('X-Groq-Check-Version'), '2026-10-06-model-config-v2');
    for (const [path, body] of [
      ['cohost/chat', { messages: [{ role: 'user', content: 'Hello' }] }],
      ['botanist/diagnose', { prompt: 'Why are the leaves brown?' }],
      ['botanist/diagnose', { prompt: 'Inspect this plant', imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAJklEQVR4nO3NMQ0AAAwDoPo33arYsQQMkB6LQCAQCAQCgUAg+BIMi1X0pjxKe0gAAAAASUVORK5CYII=' }],
    ]) {
      const response = await mf.dispatchFetch(`https://test/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200, await response.text());
    }
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(0, 3).every(payload => payload.model === 'openai/gpt-oss-20b'));
    assert.equal(calls[3].model, 'qwen/qwen3.8-27b');
  } finally { await mf.dispose(); }
});
