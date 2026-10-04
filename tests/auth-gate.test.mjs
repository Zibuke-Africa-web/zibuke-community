import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server.js';
import { loginDestination } from '../lib/login-redirect.ts';

const source = ts.transpileModule(readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, URL, require: name => {
  if (name === '@/auth') return { auth: handler => handler };
  if (name === 'next/server') return { NextResponse };
  throw new Error(`Unexpected dependency ${name}`);
} };
vm.runInNewContext(source, context);
const { default: middleware, config } = context.exports;

test('all platform paths and nested routes require authentication', () => {
  for (const url of ['/', '/feed', '/directory?q=hello', '/groups', '/groups/example', '/events', '/profile', '/profile/member', '/profile/setup', '/friends', '/messages', '/settings', '/dashboard', '/users', '/media/uploads/photo.jpg']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, url);
  }
});
test('login, OAuth endpoints and framework assets remain public', () => {
  for (const url of ['/login', '/api/auth/signin/facebook', '/api/auth/callback/facebook', '/api/auth/session', '/api/auth/csrf', '/_next/static/test.js', '/_next/image?url=photo', '/favicon.ico']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, url);
  }
});
test('missing and invalid sessions redirect without trusting a cookie', async () => {
  for (const session of [null, {}, { user: {} }]) {
    const request = new NextRequest('https://zibukecommunity.co.za/directory?q=builder', { headers: { cookie: 'authjs.session-token=forged' } });
    request.auth = session;
    const response = await middleware(request);
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.pathname, '/login');
    assert.equal(destination.searchParams.get('callbackUrl'), '/directory?q=builder');
  }
});
test('an Auth.js-validated session can continue', async () => {
  const request = new NextRequest('https://zibukecommunity.co.za/feed');
  request.auth = { user: { id: 'member' } };
  const response = await middleware(request);
  assert.equal(response.headers.get('x-middleware-next'), '1');
});
test('post-login destinations cannot escape the platform or loop into auth', () => {
  for (const value of [undefined, '/', 'https://evil.example', '//evil.example', '/\\evil.example', '/login', '/api/auth/signin', '/feed/../../login', '/feed\n']) assert.equal(loginDestination(value), '/feed');
  assert.equal(loginDestination('/profile/member?tab=posts'), '/profile/member?tab=posts');
  assert.equal(loginDestination('/directory?q=builder'), '/directory?q=builder');
});
