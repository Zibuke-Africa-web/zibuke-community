import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, crypto, URL, require: name => modules[name] ?? require(name) };
  vm.runInNewContext(source, context);
  return context.exports;
}
const schema = load('../db/schema.ts');
const input = load('../lib/space-post-input.ts');

function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const migration of ['0000_acoustic_bucky', '0001_cold_klaw', '0002_social_graph', '0003_spaces']) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${migration}.sql`, import.meta.url), 'utf8'));
  }
  sqlite.exec("PRAGMA foreign_keys = ON; INSERT INTO users(id,name) VALUES ('alice','Alice Member'),('bob','Bob Member'); INSERT INTO posts(id,user_id,content) VALUES ('legacy','alice','Keep the existing feed');");
  sqlite.exec(readFileSync(new URL('../drizzle/0004_space_posts.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0005_daily_sparks.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0006_cooing_bruce_banner.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../db/seed-spaces.sql', import.meta.url), 'utf8'));
  sqlite.exec("INSERT INTO spaces(id,slug,name,privacy) VALUES ('secret','secret','Secret','private')");
  let user = 'alice';
  let unavailable = false;
  let beforeStatement = null;
  const calls = { contexts: 0, paths: [] };
  // Real Drizzle D1 adapter over a disposable SQLite-backed D1 statement boundary.
  const d1 = {
    prepare(sql) {
      let parameters = [];
      function statement() {
        beforeStatement?.(sql);
        return sqlite.prepare(sql);
      }
      return {
        bind(...values) { parameters = values; return this; },
        async all() { return { results: statement().all(...parameters), success: true }; },
        async raw() { const stmt = statement(); stmt.setReturnArrays(true); return stmt.all(...parameters); },
        async run() { const result = statement().run(...parameters); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
  };
  const actions = load('../actions/spaces.ts', {
    '@/auth': { auth: async () => user ? { user: { id: user } } : null },
    '@/lib/gamification': { recordActivity: async () => {} },
    '@/db/schema': schema,
    '@/lib/space-post-input': input,
    '@opennextjs/cloudflare': { getCloudflareContext: async options => {
      assert.equal(options.async, true); calls.contexts++;
      if (unavailable) throw new Error('private D1 infrastructure detail');
      return { env: { DB: d1 } };
    } },
    'next/cache': { revalidatePath: path => calls.paths.push(path) },
  });
  return { ...actions, sqlite, calls, user: value => { user = value; }, fail: () => { unavailable = true; }, before: fn => { beforeStatement = fn; } };
}

test('unauthenticated mutations return UNAUTHORIZED without accessing D1', async t => {
  const h = setup(t); h.user(null);
  for (const result of [await h.joinSpaceAction('space-welcome'), await h.leaveSpaceAction('space-welcome'), await h.createSpacePostAction('space-welcome','Hello')]) {
    assert.equal(result.success, false); assert.equal(result.error, 'UNAUTHORIZED');
  }
  assert.equal(h.calls.contexts, 0);
});

test('joins are idempotent, session-owned, counted, and revalidated; leave preserves host roles', async t => {
  const h = setup(t);
  assert.equal((await h.joinSpaceAction('space-welcome')).success, true);
  assert.equal((await h.joinSpaceAction('space-welcome')).success, true);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM space_members').get().n, 1);
  const details = await h.getSpaceDetails('welcome');
  assert.equal(details.data.memberCount, 1); assert.equal(details.data.isMember, true);
  assert.equal(h.sqlite.prepare('SELECT user_id FROM space_members').get().user_id, 'alice');
  assert.ok(h.calls.paths.includes('/spaces/welcome')); assert.ok(h.calls.paths.includes('/spaces'));
  h.sqlite.exec("UPDATE space_members SET role='host'");
  assert.equal((await h.leaveSpaceAction('space-welcome')).error, 'HOST_MEMBERSHIP');
  h.sqlite.exec("UPDATE space_members SET role='member'");
  assert.equal((await h.leaveSpaceAction('space-welcome')).success, true);
  assert.equal((await h.leaveSpaceAction('space-welcome')).success, true);
  assert.equal((await h.getSpaceDetails('welcome')).data.memberCount, 0);
});

test('private and members-only posts cannot be fetched by nonmembers, including direct action calls', async t => {
  const h = setup(t);
  assert.equal((await h.joinSpaceAction('secret')).error, 'NOT_FOUND');
  assert.equal((await h.getSpaceDetails('secret')).error, 'NOT_FOUND');
  assert.equal((await h.getSpacePosts('secret')).error, 'NOT_FOUND');
  assert.equal((await h.createSpacePostAction('secret','leak')).error, 'NOT_FOUND');
  assert.equal((await h.getSpacePosts('space-creators')).error, 'MEMBERSHIP_REQUIRED');
  h.user(null);
  assert.equal((await h.getSpacePosts('space-creators')).error, 'UNAUTHORIZED');
  assert.equal((await h.getSpacePosts('space-welcome')).success, true);
  h.user('alice');
  h.sqlite.exec("INSERT INTO space_members(id,space_id,user_id) VALUES ('invite','secret','alice')");
  assert.equal((await h.createSpacePostAction('secret','Private discussion')).success, true);
  assert.equal((await h.getSpacePosts('secret')).data[0].content, 'Private discussion');
  h.user('bob');
  assert.equal((await h.getSpacePosts('secret')).error, 'NOT_FOUND');
});

test('publishing validates content/media, scopes posts and author data, and preserves legacy posts', async t => {
  const h = setup(t);
  assert.equal((await h.createSpacePostAction('space-welcome','Hi')).error, 'MEMBERSHIP_REQUIRED');
  await h.joinSpaceAction('space-welcome');
  for (const content of ['', '   ', 'a'.repeat(5001), null]) assert.equal((await h.createSpacePostAction('space-welcome', content)).error, 'INVALID_CONTENT');
  for (const media of ['javascript:alert(1)', 'data:text/html,hello', '//evil.test', 'https://user:pass@example.com']) {
    assert.equal((await h.createSpacePostAction('space-welcome','Hello',media)).error, 'INVALID_MEDIA');
  }
  const published = await h.createSpacePostAction('space-welcome', '  Hello\r\nworld\0  ', 'https://example.com/photo.jpg');
  assert.equal(published.success, true);
  const feed = await h.getSpacePosts('space-welcome');
  assert.equal(feed.data.length, 1); assert.equal(feed.data[0].content, 'Hello\nworld');
  assert.equal(feed.data[0].author.id, 'alice'); assert.equal(feed.data[0].author.initials, 'AM');
  assert.equal(feed.data[0].mediaUrl, 'https://example.com/photo.jpg');
  assert.equal((await h.getSpacePosts('space-business')).data.length, 0);
  assert.equal((await h.createSpacePostAction('space-welcome', 'x'.repeat(5000))).success, true);
  h.sqlite.exec("INSERT INTO posts(id,user_id,space_id,content,created_at) VALUES ('newest','alice','space-welcome','Newest',4102444800)");
  assert.equal((await h.getSpacePosts('space-welcome')).data[0].id, 'newest');
  assert.equal(h.sqlite.prepare("SELECT content FROM posts WHERE space_id IS NULL").get().content, 'Keep the existing feed');
  assert.throws(() => h.sqlite.exec("INSERT INTO posts(id,user_id,space_id,content) VALUES ('bad','alice','missing','x')"));
  h.sqlite.exec("DELETE FROM spaces WHERE id='space-welcome'");
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM posts WHERE id <> 'legacy'").get().n, 0);
});

test('membership removal between read and publish prevents insertion atomically', async t => {
  const h = setup(t);
  await h.joinSpaceAction('space-welcome');
  h.before(sql => { if (sql.startsWith('insert into posts')) h.sqlite.exec('DELETE FROM space_members'); });
  assert.equal((await h.createSpacePostAction('space-welcome','Race')).error, 'MEMBERSHIP_REQUIRED');
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM posts WHERE space_id IS NOT NULL").get().n, 0);
});

test('D1 failures return safe errors rather than leaking or throwing', async t => {
  const h = setup(t); h.fail();
  for (const result of [await h.joinSpaceAction('space-welcome'), await h.leaveSpaceAction('space-welcome'), await h.createSpacePostAction('space-welcome','Hi'), await h.getSpaceDetails('welcome'), await h.getSpacePosts('space-welcome')]) {
    assert.equal(result.error, 'UNAVAILABLE');
  }
  assert.equal(h.calls.paths.length, 0);
});

test('main-feed publishing persists through the space action with session ownership and refreshes both feeds', async t => {
  const h = setup(t);
  h.user(null);
  assert.equal((await h.createPost('Hello')).error, 'UNAUTHORIZED');
  assert.equal((await h.getCommunityFeed()).error, 'UNAUTHORIZED');
  assert.equal(h.calls.contexts, 0);
  h.user('alice');
  assert.equal((await h.createPost('   ')).error, 'INVALID_CONTENT');
  assert.equal((await h.createPost('Hello', 'javascript:alert(1)')).error, 'INVALID_MEDIA');
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM space_members').get().n, 0);
  const result = await h.createPost('  Persistent hello  ', '/media/uploads/photo.jpg');
  assert.equal(result.success, true);
  const saved = h.sqlite.prepare('SELECT * FROM posts WHERE id=?').get(result.data.id);
  assert.equal(saved.user_id, 'alice');
  assert.equal(saved.space_id, 'space-welcome');
  assert.equal(saved.content, 'Persistent hello');
  assert.equal(saved.media_url, '/media/uploads/photo.jpg');
  assert.ok(h.calls.paths.includes('/'));
  assert.ok(h.calls.paths.includes('/feed'));
  assert.ok(h.calls.paths.includes('/spaces/welcome'));
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM space_members').get().n, 1);
  assert.equal((await h.getCommunityFeed()).data.posts[0].id, saved.id);
  await h.createPost('Second post');
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM space_members').get().n, 1);
});

test('public feed merges public space posts and system sparks chronologically without private, paid or legacy leakage', async t => {
  const h = setup(t);
  h.sqlite.exec(`
    INSERT INTO users(id,name) VALUES ('system-zibuke-community','Zibuke Community');
    INSERT INTO groups(id,name,privacy,visibility) VALUES ('hidden','Secret group','private','hidden');
    INSERT INTO spaces(id,slug,name,privacy,is_paywalled) VALUES ('paid','paid','Paid','public',1);
    INSERT INTO daily_sparks(id,topic,prompt,is_active) VALUES ('spark-test','Topic','Spark prompt',1);
    INSERT INTO posts(id,user_id,space_id,group_id,content,created_at,media_url) VALUES
      ('general','alice','space-welcome',null,'General',100,'javascript:bad'),
      ('business','bob','space-business',null,'Business',300,'https://example.com/photo.jpg'),
      ('spark-test','system-zibuke-community',null,null,'Spark',200,null),
      ('bot','system-zibuke-community',null,null,'Community bot update',150,null),
      ('private','alice','secret',null,'Secret',999,null),
      ('members','alice','space-creators',null,'Members only',999,null),
      ('paywall','alice','paid',null,'Paid',999,null),
      ('hidden-group','alice',null,'hidden','Private group',999,null),
      ('mixed-group','alice','space-welcome','hidden','Private group in public space',999,null);
  `);
  const feed = await h.getCommunityFeed();
  assert.equal(feed.success, true);
  assert.deepEqual(Array.from(feed.data.posts, post => post.id), ['business','spark-test','bot','general']);
  assert.equal(feed.data.posts[1].isDailySpark, true);
  assert.equal(feed.data.posts[2].isDailySpark, false);
  assert.equal(feed.data.posts[3].space.slug, 'welcome');
  assert.equal(feed.data.posts[0].author.name, 'Bob Member');
  assert.equal(feed.data.posts[0].mediaUrl, 'https://example.com/photo.jpg');
  assert.equal(feed.data.posts[3].mediaUrl, null);
  h.sqlite.exec("UPDATE spaces SET privacy='private' WHERE slug='welcome'");
  assert.ok(!(await h.getCommunityFeed()).data.posts.some(post => post.id === 'general'));
});

test('feed pagination is bounded and deterministic for equal timestamps', async t => {
  const h = setup(t);
  for (let i = 0; i < 35; i++) h.sqlite.prepare('INSERT INTO posts(id,user_id,space_id,content,created_at) VALUES (?,?,?,?,?)').run(`page-${String(i).padStart(2,'0')}`, 'alice','space-welcome','Post',100);
  const first = (await h.getCommunityFeed()).data;
  const second = (await h.getCommunityFeed(2)).data;
  assert.equal(first.posts.length, 30); assert.equal(first.hasMore, true);
  assert.equal(second.posts.length, 5); assert.equal(second.hasMore, false);
  assert.equal(first.posts[0].id, 'page-34');
  assert.equal(new Set([...first.posts, ...second.posts].map(post => post.id)).size, 35);
  for (const page of [0, -1, 1.5, 10001, '1', NaN]) assert.equal((await h.getCommunityFeed(page)).error, 'INVALID_INPUT');
});

test('main composer fails closed when General is missing, private, paid or changes privacy during publishing', async t => {
  const h = setup(t);
  h.sqlite.exec("UPDATE spaces SET privacy='private' WHERE slug='welcome'");
  assert.equal((await h.createPost('No')).success, false);
  h.sqlite.exec("UPDATE spaces SET privacy='public',is_paywalled=1 WHERE slug='welcome'");
  assert.equal((await h.createPost('No')).success, false);
  h.sqlite.exec("UPDATE spaces SET is_paywalled=0 WHERE slug='welcome'");
  h.before(sql => { if (sql.startsWith('insert into posts')) h.sqlite.exec("UPDATE spaces SET privacy='private' WHERE slug='welcome'"); });
  assert.equal((await h.createPost('Race')).success, false);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM posts WHERE space_id IS NOT NULL').get().n, 0);
  h.before(null);
  h.sqlite.exec("DELETE FROM spaces WHERE slug='welcome'");
  assert.equal((await h.createPost('No destination')).error, 'UNAVAILABLE');
  h.fail();
  assert.equal((await h.getCommunityFeed()).error, 'UNAVAILABLE');
});
