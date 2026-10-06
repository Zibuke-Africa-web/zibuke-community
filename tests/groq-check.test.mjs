import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const routeSource = ts.transpileModule(readFileSync(new URL('../app/api/groq-check/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ key = 'private-test-key', fallback = '', contextFails = false, modelStatus = 200, visionStatus = 200,
  modelBody = { data: [{ id: 'qwen/qwen3.8-27b' }] }, content = 'OK', finish = 'stop', timeout = false } = {}) {
  const calls = [];
  let contextCalls = 0;
  const context = { exports: {}, Response, URL, AbortSignal, Error, process: { env: { GROQ_API_KEY: fallback } },
    require: name => {
      assert.equal(name, '@opennextjs/cloudflare');
      return { getCloudflareContext: async options => {
        contextCalls++; assert.equal(options.async, true);
        if (contextFails) throw new Error('private context error');
        return { env: { GROQ_API_KEY: key } };
      } };
    },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      if (timeout) { const error = new Error('private timeout detail'); error.name = 'TimeoutError'; throw error; }
      const isModels = url.endsWith('/models');
      const status = isModels ? modelStatus : visionStatus;
      return Response.json(status === 200 ? isModels ? modelBody : { choices: [{ message: { content }, finish_reason: finish }] } : { error: 'private provider error' }, { status });
    },
  };
  vm.runInNewContext(routeSource, context);
  const request = (query = '?secret=zibuke-check') => ({ nextUrl: new URL(`https://community.test/api/groq-check${query}`), signal: new AbortController().signal });
  return { ...context.exports, calls, request, contextCalls: () => contextCalls };
}

test('missing or wrong query gate returns 401 before reading secrets or contacting Groq', async () => {
  const h = harness();
  for (const query of ['', '?secret=wrong']) {
    const response = await h.GET(h.request(query));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'UNAUTHORIZED' });
    assert.ok(response.headers.get('cache-control').includes('no-store'));
  }
  assert.equal(h.contextCalls(), 0); assert.equal(h.calls.length, 0);
});

test('prefers Cloudflare binding and verifies authentication plus image inference without exposing secrets', async () => {
  const h = harness({ fallback: 'unused-fallback', content: 'private model response' });
  const response = await h.GET(h.request());
  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.ok, true); assert.equal(output.keySource, 'cloudflare');
  assert.equal(output.authenticated, true); assert.equal(output.vision.ok, true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].url, 'https://api.groq.com/openai/v1/models');
  assert.equal(h.calls[1].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(h.calls[1].headers.Authorization, 'Bearer private-test-key');
  const payload = JSON.parse(h.calls[1].body);
  assert.equal(payload.model, 'qwen/qwen3.8-27b');
  assert.ok(payload.messages[0].content[1].image_url.url.startsWith('data:image/png;base64,'));
  assert.ok(!JSON.stringify(output).includes('private'));
});

test('fallback works for absent binding and unavailable context; missing key never calls Groq', async () => {
  for (const options of [{ key: '' }, { contextFails: true }]) {
    const h = harness({ ...options, fallback: 'fallback-key' });
    const response = await h.GET(h.request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).keySource, 'process.env');
    assert.equal(h.calls[0].headers.Authorization, 'Bearer fallback-key');
  }
  const missing = harness({ key: '' });
  const response = await missing.GET(missing.request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).keyBound, false);
  assert.equal(missing.calls.length, 0);
});

test('authentication failure short-circuits vision; provider details stay private', async () => {
  for (const status of [401, 403, 429, 500]) {
    const h = harness({ modelStatus: status });
    const response = await h.GET(h.request());
    assert.equal(response.status, status === 429 ? 429 : 502);
    const data = await response.json();
    assert.equal(data.stage, 'authentication'); assert.equal(data.authenticated, false);
    assert.equal(data.upstreamStatus, status); assert.equal(h.calls.length, 1);
    assert.ok(!JSON.stringify(data).includes('private'));
  }
});

test('vision access failures, incomplete results and timeouts cannot report a healthy endpoint', async () => {
  for (const [options, expected] of [
    [{ visionStatus: 403 }, 502], [{ visionStatus: 429 }, 429], [{ finish: 'length' }, 502],
    [{ content: '' }, 502], [{ content: null }, 502], [{ modelBody: {} }, 502], [{ timeout: true }, 504],
  ]) {
    const h = harness(options);
    const response = await h.GET(h.request());
    assert.equal(response.status, expected);
    const data = await response.json();
    assert.equal(data.ok, false); assert.equal(data.vision.ok, false);
    assert.ok(!JSON.stringify(data).includes('private'));
  }
});

const scriptSource = readFileSync(new URL('../scripts/groq-check.mjs', import.meta.url), 'utf8');
async function runScript({ status = 200, body = { ok: true, keyBound: true, keySource: 'cloudflare', authenticated: true, vision: { ok: true } }, target = 'https://community.test' } = {}) {
  const logs = []; const calls = [];
  const process = { argv: ['node', 'groq-check.mjs', target], exitCode: undefined };
  await vm.runInNewContext(`(async () => { ${scriptSource}\n })()`, {
    process, URL, AbortSignal, console: { log: value => logs.push(value), error: value => logs.push(value) },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json(body, { status }); },
  });
  return { process, logs, calls };
}

test('script checks the deployed route and returns failure for partial or unsuccessful checks', async () => {
  const success = await runScript();
  assert.equal(success.process.exitCode, undefined);
  assert.equal(success.calls[0].url.pathname, '/api/groq-check');
  assert.equal(success.calls[0].url.searchParams.get('secret'), 'zibuke-check');
  assert.ok(success.logs.some(line => line.includes('PASS')));
  for (const options of [{ status: 502 }, { body: { ok: true, secret: 'private-secret' } }, { target: 'http://remote.test' }]) {
    const failed = await runScript(options);
    assert.equal(failed.process.exitCode, 1);
    assert.ok(!failed.logs.join('').includes('private-secret'));
  }
});
