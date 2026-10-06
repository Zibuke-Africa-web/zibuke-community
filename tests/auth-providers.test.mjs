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
env.AUTH_RESEND_FROM = 'Zibuke Community <login@example.com>';
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
vm.runInNewContext(source, { exports: {}, require: name => {
  if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
  return modules[name];
} });
const config = await factory();

test('all providers use the Cloudflare environment with database sessions', () => {
  assert.equal(config.session.strategy, 'database');
  assert.equal(config.pages.signIn, '/login');
  assert.equal(config.adapter.tables.verificationTokensTable, 'verificationTokens');
  assert.deepEqual(Array.from(config.providers, provider => provider.id), ['facebook', 'google', 'linkedin', 'resend']);
  for (const id of ['facebook', 'google', 'linkedin']) {
    const provider = config.providers.find(provider => provider.id === id);
    assert.equal(provider.options.clientId, env[`AUTH_${id.toUpperCase()}_ID`]);
    assert.equal(provider.options.clientSecret, env[`AUTH_${id.toUpperCase()}_SECRET`]);
  }
  const linkedin = config.providers.find(provider => provider.id === 'linkedin');
  assert.equal(linkedin.type, 'oidc');
  assert.equal(linkedin.options.authorization.params.scope, 'openid profile email');
});

test('Resend uses fetch with the configured sender, key, link and expiry', async () => {
  const base = config.providers.find(provider => provider.id === 'resend');
  const provider = { ...base, ...base.options };
  assert.equal(provider.maxAge, 1800);
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options) => { sent = { url, options }; return new Response('{}', { status: 200 }); };
  try {
    await provider.sendVerificationRequest({ identifier: 'member@example.com', provider, url: 'https://zibukecommunity.co.za/api/auth/callback/resend?token=test-token', theme: {} });
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.options.method, 'POST');
    assert.equal(sent.options.headers.Authorization, `Bearer ${env.AUTH_RESEND_KEY}`);
    const body = JSON.parse(sent.options.body);
    assert.equal(body.from, env.AUTH_RESEND_FROM);
    assert.equal(body.to, 'member@example.com');
    assert.ok(body.text.includes('/api/auth/callback/resend?token=test-token'));
    globalThis.fetch = async () => new Response('{"message":"rejected"}', { status: 403 });
    await assert.rejects(provider.sendVerificationRequest({ identifier: 'member@example.com', provider, url: 'https://zibukecommunity.co.za/api/auth/callback/resend?token=test-token', theme: {} }), /Resend error/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
