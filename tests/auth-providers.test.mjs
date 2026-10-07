import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import Facebook from 'next-auth/providers/facebook';
import Google from 'next-auth/providers/google';
import LinkedIn from 'next-auth/providers/linkedin';
import Resend from 'next-auth/providers/resend';

const env = Object.fromEntries(['SECRET', 'FACEBOOK_ID', 'FACEBOOK_SECRET', 'GOOGLE_ID', 'GOOGLE_SECRET', 'LINKEDIN_ID', 'LINKEDIN_SECRET', 'RESEND_KEY', 'RESEND_FROM'].map(key => [`AUTH_${key}`, `test-${key}`]));
delete env.AUTH_RESEND_KEY;
let factory;
const source = ts.transpileModule(readFileSync(new URL('../auth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modules = {
  '@/lib/gamification': { recordActivity: async () => {} },
  'next-auth': { default: callback => { factory = callback; return {}; } },
  '@auth/drizzle-adapter': { DrizzleAdapter: (_db, tables) => ({ tables }) },
  '@opennextjs/cloudflare': { getCloudflareContext: async options => { assert.equal(options.async, true); return { env }; } },
  '@/db': { getDb: async () => ({}) },
  '@/db/schema': { users: 'users', accounts: 'accounts', sessions: 'sessions', verificationTokens: 'verificationTokens' },
  'next-auth/providers/facebook': { default: Facebook },
  'next-auth/providers/google': { default: Google },
  'next-auth/providers/linkedin': { default: LinkedIn },
  'next-auth/providers/resend': { default: Resend },
};
const processEnv = { AUTH_GOOGLE_ID: 'process-google-id', AUTH_GOOGLE_SECRET: 'process-google-secret', AUTH_LINKEDIN_ID: 'process-linkedin-id', AUTH_LINKEDIN_SECRET: 'process-linkedin-secret' };
vm.runInNewContext(source, { exports: {}, process: { env: processEnv }, require: name => {
  if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
  return modules[name];
} });
const config = await factory();

test('providers use their configured environments with database sessions', () => {
  assert.equal(config.session.strategy, 'database');
  assert.equal(config.pages.signIn, '/login');
  assert.equal(config.adapter.tables.verificationTokensTable, 'verificationTokens');
  assert.deepEqual(Array.from(config.providers, provider => provider.id), ['facebook', 'google', 'linkedin', 'resend']);
  for (const id of ['facebook']) {
    const provider = config.providers.find(provider => provider.id === id);
    assert.equal(provider.options.clientId, env[`AUTH_${id.toUpperCase()}_ID`]);
    assert.equal(provider.options.clientSecret, env[`AUTH_${id.toUpperCase()}_SECRET`]);
  }
  const linkedin = config.providers.find(provider => provider.id === 'linkedin');
  assert.equal(linkedin.type, 'oidc');
  assert.equal(linkedin.options.authorization.params.scope, 'openid profile email');
});

test('Google uses process credentials, trusted host and email account linking', async () => {
  const google = config.providers.find(provider => provider.id === 'google');
  assert.equal(config.trustHost, true);
  assert.equal(google.options.clientId, processEnv.AUTH_GOOGLE_ID);
  assert.equal(google.options.clientSecret, processEnv.AUTH_GOOGLE_SECRET);
  assert.equal(google.options.allowDangerousEmailAccountLinking, true);
  const originalId = processEnv.AUTH_GOOGLE_ID;
  try {
    for (const value of [undefined, '']) {
      processEnv.AUTH_GOOGLE_ID = value;
      const fallbackConfig = await factory();
      assert.equal(fallbackConfig.providers.find(provider => provider.id === 'google').options.clientId, '508155139796-t8tsrimj6o873k41gods9eskauuqkv75.apps.googleusercontent.com');
    }
  } finally {
    processEnv.AUTH_GOOGLE_ID = originalId;
  }
});

test('LinkedIn uses process credentials and fallback ID with email account linking', async () => {
  const linkedin = config.providers.find(provider => provider.id === 'linkedin');
  assert.equal(linkedin.options.clientId, processEnv.AUTH_LINKEDIN_ID);
  assert.equal(linkedin.options.clientSecret, processEnv.AUTH_LINKEDIN_SECRET);
  assert.equal(linkedin.options.allowDangerousEmailAccountLinking, true);
  const originalId = processEnv.AUTH_LINKEDIN_ID;
  try {
    for (const value of [undefined, '']) {
      processEnv.AUTH_LINKEDIN_ID = value;
      const fallbackConfig = await factory();
      assert.equal(fallbackConfig.providers.find(provider => provider.id === 'linkedin').options.clientId, '78gaenvt8cg1i0');
    }
  } finally {
    processEnv.AUTH_LINKEDIN_ID = originalId;
  }
});

test('Resend uses HTTPS to send the magic link and reports delivery errors', async () => {
  const base = config.providers.find(provider => provider.id === 'resend');
  const provider = { ...base, ...base.options, apiKey: 'test-resend-key' };
  assert.equal(provider.maxAge, 1800);
  assert.equal(provider.from, 'Zibuke Community <noreply@zibukeafrica.com>');
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options) => { sent = { url, options }; return new Response('{}', { status: 200 }); };
  const request = { identifier: 'member@example.com', provider, url: 'https://zibukecommunity.co.za/api/auth/callback/resend?token=test-token', theme: {} };
  try {
    await provider.sendVerificationRequest(request);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.options.method, 'POST');
    assert.equal(sent.options.headers.Authorization, 'Bearer test-resend-key');
    const body = JSON.parse(sent.options.body);
    assert.equal(body.from, provider.from);
    assert.equal(body.to, 'member@example.com');
    assert.ok(body.text.includes('/api/auth/callback/resend?token=test-token'));
    globalThis.fetch = async () => new Response('{"message":"rejected"}', { status: 403 });
    await assert.rejects(provider.sendVerificationRequest(request), /Resend error/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Resend never falls back to authjs.dev when EMAIL_FROM is missing or empty', async () => {
  const originalFrom = processEnv.EMAIL_FROM;
  const originalFetch = globalThis.fetch;
  const senders = [];
  globalThis.fetch = async (_url, options) => {
    senders.push(JSON.parse(options.body).from);
    return new Response('{}', { status: 200 });
  };
  try {
    for (const value of [undefined, '']) {
      processEnv.EMAIL_FROM = value;
      const base = (await factory()).providers.find(provider => provider.id === 'resend');
      const provider = { ...base, ...base.options, apiKey: 'test-key' };
      await provider.sendVerificationRequest({ identifier: 'member@example.com', provider, url: 'https://zibukecommunity.co.za/api/auth/callback/resend?token=test-token', theme: {} });
    }
    assert.deepEqual(senders, [
      'Zibuke Community <noreply@zibukeafrica.com>',
      'Zibuke Community <noreply@zibukeafrica.com>',
    ]);
  } finally {
    if (originalFrom === undefined) delete processEnv.EMAIL_FROM;
    else processEnv.EMAIL_FROM = originalFrom;
    globalThis.fetch = originalFetch;
  }
});

test('Resend prefers AUTH_RESEND_KEY and falls back to RESEND_API_KEY', async () => {
  Object.assign(processEnv, { AUTH_RESEND_KEY: 'primary-key', RESEND_API_KEY: 'fallback-key', EMAIL_FROM: 'Login <login@example.com>' });
  try {
    let provider = (await factory()).providers.find(provider => provider.id === 'resend').options;
    assert.equal(provider.apiKey, 'primary-key');
    assert.equal(provider.from, processEnv.EMAIL_FROM);
    for (const value of [undefined, '']) {
      processEnv.AUTH_RESEND_KEY = value;
      provider = (await factory()).providers.find(provider => provider.id === 'resend').options;
      assert.equal(provider.apiKey, 'fallback-key');
    }
  } finally {
    delete processEnv.AUTH_RESEND_KEY;
    delete processEnv.RESEND_API_KEY;
    delete processEnv.EMAIL_FROM;
  }
});

test('Resend reads Worker bindings and normalizes the legacy sender format', async () => {
  env.AUTH_RESEND_KEY = 'worker-key';
  env.EMAIL_FROM = 'Zibuke Community noreply@zibukeafrica.com';
  try {
    const provider = (await factory()).providers.find(p => p.id === 'resend').options;
    assert.equal(provider.apiKey, 'worker-key');
    assert.equal(provider.from, 'Zibuke Community <noreply@zibukeafrica.com>');
    delete env.AUTH_RESEND_KEY;
    env.RESEND_API_KEY = 'worker-fallback';
    assert.equal((await factory()).providers.find(p => p.id === 'resend').options.apiKey, 'worker-fallback');
  } finally {
    delete env.AUTH_RESEND_KEY;
    delete env.RESEND_API_KEY;
    delete env.EMAIL_FROM;
  }
});
