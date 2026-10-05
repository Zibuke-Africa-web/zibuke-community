import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, crypto, URL, Date, Response, require: name => modules[name] ?? require(name) };
  vm.runInNewContext(code, context); return context.exports;
}
const schema = load('../db/schema.ts');
const shared = load('../lib/daily-spark.ts');
const now = new Date('2026-10-05T06:00:00Z');
const answer = { topic: 'Grow together', prompt: 'What garden skill could you share with a neighbour this week?', targetSpaceSlug: 'welcome' };

function harness(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const dir = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));
  sqlite.exec(readFileSync(new URL('../db/seed-spaces.sql', import.meta.url), 'utf8'));
  sqlite.exec("PRAGMA foreign_keys=ON; INSERT INTO users(id,name) VALUES ('alice','Alice'); INSERT INTO groups(id,name,privacy) VALUES ('private-group','Secret','private');");
  const stamp = Math.floor(now.getTime()/1000);
  sqlite.prepare('INSERT INTO posts(id,user_id,space_id,group_id,content,created_at) VALUES (?,?,?,?,?,?)').run('public','alice','space-welcome',null,'Welcome! Contact alice@example.com to build a garden.',stamp-100);
  sqlite.prepare('INSERT INTO posts(id,user_id,space_id,group_id,content,created_at) VALUES (?,?,?,?,?,?)').run('private','alice','space-creators',null,'Secret business project',stamp-100);
  sqlite.prepare('INSERT INTO posts(id,user_id,space_id,group_id,content,created_at) VALUES (?,?,?,?,?,?)').run('group','alice',null,'private-group','Hidden business project',stamp-100);
  let broken = false, response = { response: JSON.stringify(answer) }, aiCalls = 0, input;
  let queue = Promise.resolve();
  const d1 = {
    prepare(sql) {
      let params=[];
      return { bind(...values){params=values;return this},
        async all(){ if(broken && sql.startsWith('insert into "posts"')) throw Error('write failed'); const stmt=sqlite.prepare(sql); return {success:true,results:stmt.all(...params)}; },
        async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...params)},
        async run(){return {success:true,meta:sqlite.prepare(sql).run(...params)}} };
    },
    async batch(statements) {
      const result=queue.then(async()=>{ sqlite.exec('BEGIN');try { const results=[];for(const stmt of statements) results.push(await stmt.all());sqlite.exec('COMMIT');return results; } catch(error){sqlite.exec('ROLLBACK');throw error;} });
      queue=result.catch(()=>{});return result;
    },
  };
  const env={DB:d1,AI:{run:async(model,payload)=>{aiCalls++;input=payload;assert.equal(model,'@cf/meta/llama-3.1-8b-instruct-fp8');return response;}}};
  const engine=load('../lib/daily-spark-server.ts',{'server-only':{},'@/db/schema':schema,'./daily-spark':shared,'@/db':{getDb:async()=>require('drizzle-orm/d1').drizzle(d1)}});
  return {...engine,env,sqlite,aiCalls:()=>aiCalls,input:()=>input,fail:()=>{broken=true},answer:value=>{response=value}};
}

test('cron rejects invalid tokens before generation and fails closed without configuration',async()=>{
  let calls=0;let secret='test-secret';
  const route=load('../app/api/cron/daily-spark/route.ts',{
    '@opennextjs/cloudflare':{getCloudflareContext:async()=>({env:{CRON_SECRET:secret}})},
    '@/lib/daily-spark-server':{generateDailySpark:async()=>{calls++;return {id:'test',generated:true}}},
    'next/cache':{revalidatePath:()=>{}},
  });
  assert.equal((await route.POST(new Request('https://test/'))).status,401);
  assert.equal((await route.GET(new Request('https://test/',{headers:{Authorization:'Bearer wrong'}}))).status,401);
  assert.equal(calls,0);
  assert.equal((await route.POST(new Request('https://test/',{headers:{Authorization:'Bearer test-secret'}}))).status,200);
  assert.equal(calls,1);secret='';
  assert.equal((await route.POST(new Request('https://test/',{headers:{Authorization:'Bearer '}}))).status,503);
});

test('engine publishes once per SA day, uses public aggregate context, and atomically rotates spark',async t=>{
  const h=harness(t);
  assert.equal((await h.getActiveSpark()).id,'curated-welcome');
  assert.equal((await h.generateDailySpark(h.env,now)).generated,true);
  const data=JSON.parse(h.input().messages[1].content);
  assert.equal(data.publicPostCount,1);assert.equal(data.topicActivity.entrepreneurship,0);
  assert.equal(JSON.stringify(data).includes('alice@example.com'),false);
  assert.equal(data.publicSpaces.some(space=>space.slug==='creators'),false);
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM posts WHERE user_id='system-zibuke-community'").get().n,1);
  assert.equal((await h.generateDailySpark(h.env,now)).generated,false);assert.equal(h.aiCalls(),1);
  assert.equal((await h.getActiveSpark()).prompt,answer.prompt);
  await h.generateDailySpark(h.env,new Date('2026-10-06T06:00:00Z'));
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM daily_sparks WHERE is_active=1').get().n,1);
  assert.equal(h.sqlite.prepare('SELECT id FROM daily_sparks WHERE is_active=1').get().id,'spark-2026-10-06');
});

test('failed AI validation and failed batch preserve the previous active spark',async t=>{
  const h=harness(t);await h.generateDailySpark(h.env,now);
  h.answer({response:'not JSON'});
  await assert.rejects(()=>h.generateDailySpark(h.env,new Date('2026-10-06T06:00:00Z')));
  h.answer({response:JSON.stringify(answer)});h.fail();
  await assert.rejects(()=>h.generateDailySpark(h.env,new Date('2026-10-06T06:00:00Z')));
  assert.equal(h.sqlite.prepare('SELECT id FROM daily_sparks WHERE is_active=1').get().id,'spark-2026-10-05');
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM daily_sparks').get().n,1);
});

test('response validation rejects unsafe links and private destinations; calendar uses Johannesburg',()=>{
  assert.equal(shared.sparkDay(new Date('2026-10-05T22:01:00Z')),'2026-10-06');
  for(const change of [{prompt:'Visit https://evil.test today to make money'},{targetSpaceSlug:'creators'},{prompt:'<script>alert(1)</script> today'},{prompt:'Call +27 82 123 4567 to discuss your idea'}]){
    assert.equal(shared.parseSparkResponse({response:JSON.stringify({...answer,...change})},['welcome']),null);
  }
});

test('concurrent runs publish exactly once and missing tables have a curated read fallback',async t=>{
  const h=harness(t);
  const results=await Promise.all([h.generateDailySpark(h.env,now),h.generateDailySpark(h.env,now)]);
  assert.equal(results.filter(result=>result.generated).length,1);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM daily_sparks').get().n,1);
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM posts WHERE user_id='system-zibuke-community'").get().n,1);
  h.sqlite.exec('DROP TABLE daily_sparks');
  assert.equal((await h.getActiveSpark()).id,'curated-welcome');
});
