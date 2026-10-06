import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/groq-check/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const configContext = { exports: {}, process: { env: {} } };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/groq-config.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, configContext);

function harness({ key = 'private-test-key', fallback = '', contextFails = false, status = 200, body = { choices: [{ message: { content: 'pong' } }] }, throws = false, malformed = false } = {}) {
  const calls = [];
  let contextCalls = 0;
  const context = { exports: {}, URL, AbortSignal, Error, process: { env: { GROQ_API_KEY: fallback } },
    require: name => {
      if (name === '@/lib/groq-config') return configContext.exports;
      if (name === 'next/server') return { NextResponse: Response };
      assert.equal(name, '@opennextjs/cloudflare');
      return { getCloudflareContext: async options => {
        contextCalls++; assert.equal(options.async, true);
        if (contextFails) throw new Error('No context');
        return { env: { GROQ_API_KEY: key, AI: {}, DB: {} } };
      } };
    },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      if (throws) throw new Error('Network unavailable');
      return malformed ? new Response('not json', { status }) : Response.json(body, { status });
    },
  };
  vm.runInNewContext(compiled, context);
  const request = (query = '?secret=zibuke-check') => new Request(`https://community.test/api/groq-check${query}`);
  return { ...context.exports, calls, request, contextCalls: () => contextCalls };
}

test('uses only named runtime imports and the default runtime with dynamic rendering', () => {
  const h = harness();
  assert.equal(h.dynamic, 'force-dynamic');
  assert.equal(h.runtime, undefined);
  assert.ok(!source.includes('groq-sdk'));
  assert.ok(!compiled.includes('.default'));
});

test('unauthorized calls stop before secret lookup or inference', async () => {
  const h = harness();
  for (const query of ['', '?secret=wrong']) {
    const response = await h.GET(h.request(query));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  }
  assert.equal(h.calls.length, 0); assert.equal(h.contextCalls(), 0);
});

test('sends a native text ping with the Cloudflare key and returns the requested diagnostics', async () => {
  const h = harness({ fallback: 'unused-fallback' });
  const response = await h.GET(h.request());
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('cache-control').includes('no-store'));
  const data = await response.json();
  assert.equal(data.ok, true); assert.equal(data.maskedKey, 'privat...-key');
  assert.equal(data.hasCloudflareAi, true); assert.equal(data.model, 'openai/gpt-oss-20b');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(h.calls[0].headers.Authorization, 'Bearer private-test-key');
  assert.deepEqual(JSON.parse(h.calls[0].body), { model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 512, reasoning_effort: 'low' });
});

test('falls back for absent binding and failed context lookup', async () => {
  for (const options of [{ key: '' }, { contextFails: true }]) {
    const h = harness({ ...options, fallback: 'fallback-key' });
    const response = await h.GET(h.request());
    assert.equal((await response.json()).ok, true);
    assert.equal(h.calls[0].headers.Authorization, 'Bearer fallback-key');
  }
});

test('missing key returns HTTP 200 with ok false and binding names only', async () => {
  const h = harness({ key: '' });
  const response = await h.GET(h.request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.deepEqual(data.bindingsDetected, ['GROQ_API_KEY', 'AI', 'DB']);
  assert.equal(h.calls.length, 0);
  const absent = harness({ contextFails: true });
  assert.deepEqual((await (await absent.GET(absent.request())).json()).bindingsDetected, []);
});

test('provider rejection preserves status and details; non-JSON errors and network failures are handled', async () => {
  for (const status of [401, 403, 429, 500]) {
    const h = harness({ status, body: { error: { message: 'Rejected' } } });
    const response = await h.GET(h.request());
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, false); assert.equal(data.groqStatus, status);
    assert.deepEqual(data.details, { error: { message: 'Rejected' } });
  }
  const malformed = harness({ status: 502, malformed: true });
  assert.deepEqual((await (await malformed.GET(malformed.request())).json()).details, {});
  const failed = harness({ throws: true });
  const response = await failed.GET(failed.request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: 'Network unavailable' });
});

const scriptSource = readFileSync(new URL('../scripts/groq-check.mjs', import.meta.url), 'utf8');
async function runScript(body, status = 200) {
  const logs = [];
  const process = { argv: ['node', 'groq-check.mjs', 'https://community.test'], exitCode: undefined };
  await vm.runInNewContext(`(async () => { ${scriptSource}\n })()`, {
    process, URL, AbortSignal, console: { log: value => logs.push(value), error: value => logs.push(value) },
    fetch: async () => Response.json(body, { status }),
  });
  return { process, logs };
}

test('script understands HTTP 200 failures and does not print diagnostic payloads or claim vision success', async () => {
  const success = await runScript({ ok: true, model: 'openai/gpt-oss-20b', maskedKey: 'private-value' });
  assert.equal(success.process.exitCode, undefined);
  assert.ok(success.logs.some(line => line.includes('PASS')));
  assert.ok(success.logs.some(line => line.includes('Vision inference: not checked')));
  assert.ok(!success.logs.join('').includes('private-value'));
  for (const body of [{ ok: false }, { error: 'Unauthorized' }, { ok: true }]) {
    assert.equal((await runScript(body)).process.exitCode, 1);
  }
});
