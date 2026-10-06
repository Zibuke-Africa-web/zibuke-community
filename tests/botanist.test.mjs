import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, modules = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Error, Response, Request, Blob, AbortSignal, URL, atob, ...globals,
    require: name => { if (!(name in modules)) throw new Error(`Unexpected module ${name}`); return modules[name]; } };
  vm.runInNewContext(source, context);
  return context.exports;
}
const groqConfig = load('../lib/groq-config.ts', {}, { process: { env: {} } });
const helpers = load('../lib/botanist.ts');
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

function harness({ allowed = true, session = { user: { id: 'member' } }, key = 'test-key', fallback = '', contextFails = false,
  status = 200, reply = { reply: 'Likely compacted lawn. Arrange dethatching.', isServiceRecommended: true }, finish = 'stop', throws = false } = {}) {
  const calls = [];
  const route = load('../app/api/botanist/diagnose/route.ts', {
    '@/lib/space-access': { getSpaceAccess: async () => ({ allowed }) },
    '@/lib/botanist': helpers, '@/auth': { auth: async () => session },
    '@/lib/groq-config': groqConfig,
    '@opennextjs/cloudflare': { getCloudflareContext: async options => {
      assert.equal(options.async, true);
      if (contextFails) throw new Error('No context');
      return { env: { GROQ_API_KEY: key } };
    } },
  }, { process: { env: { GROQ_API_KEY: fallback } }, fetch: async (url, options) => {
    calls.push({ url, ...options, payload: JSON.parse(options.body) });
    if (throws) { const error = new Error('Timeout'); error.name = 'TimeoutError'; throw error; }
    return Response.json(status === 200 ? { choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: finish }] } : { error: 'private provider details' }, { status });
  } });
  const request = (body = { prompt: 'My lawn needs dethatching' }, origin = 'https://community.test') => new Request('https://community.test/api/botanist/diagnose', {
    method: 'POST', headers: body instanceof FormData ? { origin } : { origin, 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { ...route, calls, request };
}

test('requires authentication and rejects cross-origin calls before inference', async () => {
  const h = harness({ session: null });
  assert.equal((await h.POST(h.request())).status, 401);
  assert.equal((await h.POST(h.request(undefined, 'https://other.test'))).status, 403);
  assert.equal(h.calls.length, 0);
});

test('text diagnosis uses text model and appends the exact trusted service handoff', async () => {
  const h = harness();
  const response = await h.POST(h.request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = await response.json();
  assert.equal(data.requiresPhysicalService, true);
  assert.ok(data.analysis.endsWith(helpers.ONCALL_TRIGGER));
  assert.equal(h.calls[0].payload.model, 'openai/gpt-oss-20b');
  assert.equal(h.calls[0].headers.Authorization, 'Bearer test-key');
  assert.equal(h.calls[0].payload.messages[0].content, helpers.BOTANIST_SYSTEM_PROMPT);
});

test('JSON and multipart photos reach vision intact; routine advice has no booking', async () => {
  for (const multipart of [false, true]) {
    const h = harness({ reply: { reply: 'Check drainage first.', isServiceRecommended: false } });
    const input = { prompt: 'Brown clivia leaves', imageBase64: photo };
    const form = new FormData();
    Object.entries(input).forEach(([key, value]) => form.set(key, value));
    const response = await h.POST(h.request(multipart ? form : input));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { analysis: 'Check drainage first.', requiresPhysicalService: false });
    assert.equal(h.calls[0].payload.model, 'qwen/qwen3.8-27b');
    assert.equal(h.calls[0].payload.messages[1].content[1].image_url.url, photo);
  }
});

test('rejects malformed questions, fake images, remote image URLs and oversized bodies', async () => {
  const h = harness();
  for (const input of ['{', null, { prompt: ' ' }, { prompt: 'x'.repeat(4001) },
    { prompt: 'Help', imageBase64: 'https://example.com/a.jpg' },
    { prompt: 'Help', imageBase64: 'data:image/png;base64,YWJjZA==' },
    { prompt: 'Help', imageBase64: 3 }]) {
    assert.equal((await h.POST(h.request(input))).status, 400);
  }
  assert.equal((await h.POST(h.request('x'.repeat(4 * 1024 * 1024 + 32769)))).status, 413);
  assert.equal(h.calls.length, 0);
});

test('supports secret fallback and handles absent configuration without inference', async () => {
  const fallback = harness({ contextFails: true, fallback: 'fallback-key' });
  assert.equal((await fallback.POST(fallback.request())).status, 200);
  assert.equal(fallback.calls[0].headers.Authorization, 'Bearer fallback-key');
  const missing = harness({ key: '' });
  assert.equal((await missing.POST(missing.request())).status, 503);
  assert.equal(missing.calls.length, 0);
});

test('handles provider limits, malformed output, truncation and timeouts safely', async () => {
  for (const [options, expected] of [
    [{ status: 429 }, 429], [{ status: 500 }, 502], [{ throws: true }, 504],
    [{ reply: { reply: 'Maybe', isServiceRecommended: 'false' } }, 502],
    [{ finish: 'length' }, 502], [{ reply: { reply: '', isServiceRecommended: false } }, 502],
  ]) {
    const h = harness(options);
    const response = await h.POST(h.request());
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes('private provider details'));
  }
});

test('a signed-in member cannot bypass GreenSpace subscription gating via the API', async () => { const h = harness({ allowed: false }); assert.equal((await h.POST(h.request())).status, 403); assert.equal(h.calls.length, 0); });
