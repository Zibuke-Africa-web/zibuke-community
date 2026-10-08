import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file, extra = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules = {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/image': { default: ({ src, alt }) => React.createElement('img', { src, alt }) },
    'next/navigation': { useRouter: () => ({ push() {} }), usePathname: () => '/feed' },
    '@/actions/spaces': { createPost() { throw new Error('No writes during render'); } },
    '@/app/actions': { uploadMedia() { throw new Error('No uploads during render'); } },
    ...extra,
  };
  const context = { exports: {}, URL, require: name => {
    if (name in modules) return modules[name];
    if (name.startsWith('@/')) throw new Error(`Unexpected server access: ${name}`);
    return require(name);
  } };
  vm.runInNewContext(source, context);
  return context.exports;
}

test('feed renders stored authors, timestamps, tags and media and escapes post text', () => {
  const { CommunityHome } = load('../components/community-home.tsx');
  const author = { id: 'alice', name: 'Alice Member', initials: 'AM', image: 'https://example.com/avatar.jpg' };
  const posts = [
    { id: 'post', author, content: '<script>not executable</script>', mediaUrl: 'https://example.com/photo.jpg', createdAt: '2026-10-08T10:00:00Z', space: { slug: 'welcome', name: 'General / Welcome' }, isDailySpark: false },
    { id: 'spark', author: { ...author, name: 'Zibuke Community' }, content: 'Daily question', mediaUrl: null, createdAt: '2026-10-08T09:00:00Z', space: null, isDailySpark: true },
  ];
  const html = renderToStaticMarkup(React.createElement(CommunityHome, { feed: { posts, page: 1, hasMore: true }, now: Date.parse('2026-10-08T10:05:00Z') }));
  for (const value of ['Alice Member', '5 minutes ago', '#General', '#DailySpark', 'photo.jpg', 'avatar.jpg', '/feed?page=2']) assert.ok(html.includes(value), value);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!/preview mode|local preview|Thandi Mokoena/i.test(html));
});

test('messages renders a coming-soon page without importing the database or legacy posts', () => {
  const { default: Page } = load('../app/(platform)/messages/page.tsx');
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.ok(html.includes('Direct Messaging coming soon'));
  assert.ok(html.includes('href="/spaces"'));
  assert.ok(!html.includes('textarea'));
});

test('legacy groups permanently redirects before loading any community data', () => {
  const { default: Page } = load('../app/(platform)/groups/page.tsx', {
    'next/navigation': { permanentRedirect: path => { throw new Error(`308:${path}`); } },
  });
  assert.throws(() => Page(), /308:\/spaces/);
});

test('primary navigation exposes Spaces without legacy groups or messages links', () => {
  const { PlatformNav } = load('../app/(platform)/platform-nav.tsx');
  const html = renderToStaticMarkup(React.createElement(PlatformNav, { profileHref: '/profile/alice' }));
  assert.ok(html.includes('href="/spaces"'));
  assert.ok(!html.includes('href="/groups"'));
  assert.ok(!html.includes('href="/messages"'));
});
