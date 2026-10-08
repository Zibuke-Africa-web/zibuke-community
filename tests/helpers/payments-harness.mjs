import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  sqlite.exec("INSERT INTO users(id,name) VALUES ('alice','Alice'),('bob','Bob')");
  let batchQueue = Promise.resolve();
  const d1 = {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...params) }; },
        async raw() { const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return stmt.all(...params); },
        async run() { return { success: true, meta: sqlite.prepare(sql).run(...params) }; },
      };
    },
    batch(statements) {
      const work = batchQueue.then(async () => {
        sqlite.exec('BEGIN');
        try { const results = []; for (const stmt of statements) results.push(await stmt.all()); sqlite.exec('COMMIT'); return results; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      });
      batchQueue = work.catch(() => {}); return work;
    },
  };
  const db = require('drizzle-orm/d1').drizzle(d1);
  let user = 'alice';
  const env = { PAYMENTS_APP_URL: 'https://community.example', PEACH_WEBHOOK_SECRET: 'fixture-peach', IKHOKHA_APP_ID: 'fixture-app', IKHOKHA_APP_SECRET: 'fixture-ik', CRON_SECRET: 'fixture-cron', PEACH_RECURRING_ENABLED: 'true', PEACH_ENTITY_ID: 'fixture-entity', PEACH_CARD_ACCESS_TOKEN: 'fixture-token' };
  const cache = new Map();
  const network = []; const processEnv = {}; const logs = [];
  let fetchImpl = async () => { throw new Error('Unexpected network request'); };
  const mocks = {
    '@/db': { getDb: async () => db },
    '@/auth': { auth: async () => user ? { user: { id: user } } : null },
    'next/cache': { revalidatePath: () => {} },
    '@opennextjs/cloudflare': { getCloudflareContext: async () => ({ env: { ...env, DB: d1 } }) },
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const source = ts.transpileModule(readFileSync(new URL(`../../${path}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports, crypto, URL, URLSearchParams, Date, Request, Response, TextEncoder, TextDecoder, AbortSignal, process: { env: processEnv }, console: { error: (...args) => logs.push(args) },
      fetch: async (...args) => { network.push(args); return fetchImpl(...args); },
      require: name => mocks[name] ?? (name.startsWith('@/') ? load(name.slice(2)) : require(name)),
    }, { filename: path });
    return exports;
  }
  return { sqlite, db, load, env, network, processEnv, logs, user: value => { user = value; }, fetch: impl => { fetchImpl = impl; } };
}

