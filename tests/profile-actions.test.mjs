import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseProfileInput } from '../lib/profile-input.ts';

// Exercise the real Server Action with isolated session/database/cache boundaries.
const source = ts.transpileModule(readFileSync(new URL('../app/profile/actions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(session, fail = false) {
  const calls = { database: 0, values: null, where: null, paths: [] };
  const chain = {
    set(values) { calls.values = values; return chain; },
    where(condition) { calls.where = condition; return chain; },
    async returning() { if (fail) throw new Error('private database detail'); return [{ id: 'owner' }]; },
  };
  const modules = {
    'drizzle-orm': { eq: (column, value) => ({ column, value }) },
    'next/cache': { revalidatePath: path => calls.paths.push(path) },
    '@/auth': { auth: async () => session },
    '@/db': { getDb: async () => { calls.database++; return { update: () => chain }; } },
    '@/db/schema': { users: { id: 'users.id' }, connections: {} },
    '@/lib/profile-input': { parseProfileInput },
  };
  const context = { exports: {}, require: name => { if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`); return modules[name]; } };
  vm.runInNewContext(source, context);
  return { save: context.exports.saveProfile, calls };
}

function validForm() {
  const data = new FormData();
  data.set('bio', 'A new bio');
  data.set('websiteUrl', 'https://example.com');
  data.set('socialLinks', '[]');
  return data;
}

test('unauthenticated callers cannot access the database', async () => {
  const { save, calls } = harness(null);
  assert.equal((await save({}, validForm())).ok, false);
  assert.equal(calls.database, 0);
});
test('owner comes from the session, never a forged form user ID', async () => {
  const { save, calls } = harness({ user: { id: 'owner' } });
  const data = validForm(); data.set('userId', 'another-user'); data.set('role', 'admin');
  assert.equal((await save({}, data)).ok, true);
  assert.equal(calls.where.value, 'owner');
  assert.equal(calls.values.role, undefined);
  assert.equal(calls.values.bio, 'A new bio');
  assert.deepEqual(calls.paths, ['/profile/owner', '/directory', '/profile/setup']);
});
test('invalid links are rejected before a write', async () => {
  const { save, calls } = harness({ user: { id: 'owner' } });
  const data = validForm(); data.set('websiteUrl', 'javascript:alert(1)');
  assert.equal((await save({}, data)).ok, false);
  assert.equal(calls.database, 0);
});
test('database failures return a safe retry message and do not revalidate', async () => {
  const { save, calls } = harness({ user: { id: 'owner' } }, true);
  const result = await save({}, validForm());
  assert.equal(result.ok, false);
  assert.ok(!result.message.includes('private database detail'));
  assert.deepEqual(calls.paths, []);
});
