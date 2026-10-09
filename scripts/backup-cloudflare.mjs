import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const account = '59d043a264dc6132d6feb01884cf2533';
const output = path.resolve(process.argv[2] || `backups/cloudflare-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await fs.mkdir(output, { recursive: true });
const auth = JSON.parse((await exec(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'auth', 'token', '--json'], { maxBuffer: 1024 * 1024 })).stdout);
const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : { 'X-Auth-Key': auth.key, 'X-Auth-Email': auth.email };
const prefix = `/accounts/${account}`;
const errors = [];
const report = { startedAt: new Date().toISOString(), account, output, workers: [], pages: [], databases: [], buckets: [], errors };
async function save(file, data) {
  const dest = path.resolve(output, file);
  if (!dest.startsWith(output + path.sep)) throw Error('Unsafe output path');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
}
async function request(endpoint) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, { headers, signal: AbortSignal.timeout(90000) });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) { await response.body?.cancel(); await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); continue; }
    if (!response.ok) throw Error(`HTTP ${response.status} ${endpoint}: ${(await response.text()).slice(0, 700)}`);
    return response;
  }
}
async function json(endpoint) {
  const data = await (await request(endpoint)).json();
  if (data.success === false) throw Error(`API failure ${endpoint}: ${JSON.stringify(data.errors)}`);
  return data;
}
async function list(endpoint) {
  if (endpoint.endsWith('/pages/projects')) return (await json(endpoint)).result;
  const all = [];
  for (let page = 1; ; page++) {
    const data = await json(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per_page=25`);
    const rows = data.result;
    if (!Array.isArray(rows)) return rows;
    all.push(...rows);
    if (data.result_info?.total_pages ? page >= data.result_info.total_pages : rows.length < 25) return all;
  }
}
async function attempt(label, fn) {
  try { return await fn(); } catch (error) {
    errors.push({ resource: label, message: error.message });
    console.log('Export gap:', label, error.message.slice(0, 160));
    await save('report.json', report);
  }
}
const [workers, pages, databases, bucketResult] = await Promise.all([
  list(`${prefix}/workers/scripts`), list(`${prefix}/pages/projects`), list(`${prefix}/d1/database`),
  attempt('R2 inventory', () => json(`${prefix}/r2/buckets`)),
]);
const selectedWorkers = workers.filter(w => process.argv.includes('--transcribe-only') ? w.id === 'transcribe' : /zibuke/i.test(w.id));
const selectedPages = pages.filter(p => !process.argv.includes('--transcribe-only') && /zibuke/i.test(p.name));
const selectedDatabases = databases.filter(d => process.argv.includes('--transcribe-only') ? d.name === 'transcribe-db' : /zibuke/i.test(d.name));
await save('inventory.json', { workers, pages, databases, buckets: bucketResult?.result });
console.log('Inventory:', JSON.stringify({ workers: selectedWorkers.map(w => w.id), pages: selectedPages.map(p => p.name), databases: selectedDatabases.map(d => d.name), buckets: bucketResult?.result }));
await save('report.json', report);
if (process.argv.includes('--inventory-only')) process.exit(0);

for (const worker of selectedWorkers) {
  const name = worker.id;
  const base = `workers/${name}`;
  const item = { name, modules: 0, codeDownloaded: false };
  report.workers.push(item);
  await attempt(`Worker ${name}`, async () => {
    const response = await request(`${prefix}/workers/scripts/${encodeURIComponent(name)}`);
    const contentType = response.headers.get('content-type') || '';
    const raw = Buffer.from(await response.arrayBuffer());
    await save(`${base}/script.raw`, raw);
    await save(`${base}/response-headers.json`, Object.fromEntries(response.headers));
    if (contentType.includes('multipart/')) {
      const form = await new Response(raw, { headers: { 'content-type': contentType } }).formData();
      const modules = [];
      for (const [key, value] of form) {
        const filename = typeof value === 'string' ? key : value.name || key;
        const safe = filename.replace(/\\/g, '/');
        if (safe.split('/').some(segment => segment === '..') || path.isAbsolute(safe) || safe.includes(':')) throw Error('Unsafe module name');
        await save(`${base}/modules/${safe}`, typeof value === 'string' ? value : Buffer.from(await value.arrayBuffer()));
        modules.push({ key, filename: safe, type: value.type });
      }
      item.modules = modules.length;
      await save(`${base}/modules.json`, modules);
    } else { await save(`${base}/worker.js`, raw); item.modules = 1; }
    item.codeDownloaded = true;
  });
  for (const endpoint of ['settings', 'script-settings', 'schedules', 'subdomain', 'secrets', 'deployments', 'versions']) {
    await attempt(`${name}/${endpoint}`, async () => save(`${base}/${endpoint}.json`, await json(`${prefix}/workers/scripts/${encodeURIComponent(name)}/${endpoint}`)));
  }
  console.log('Worker exported:', name, item.modules, 'modules');
  await save('report.json', report);
}
await attempt('Worker custom domains', async () => save('worker-domains.json', await list(`${prefix}/workers/domains`)));
for (const project of selectedPages) {
  const base = `pages/${project.name}`;
  report.pages.push({ name: project.name, deploymentFiles: false });
  await save(`${base}/project.json`, project);
  await attempt(`Pages ${project.name} configuration`, async () => save(`${base}/configuration.json`, await json(`${prefix}/pages/projects/${project.name}`)));
  await attempt(`Pages ${project.name} deployments`, async () => save(`${base}/deployments.json`, await list(`${prefix}/pages/projects/${project.name}/deployments`)));
  await attempt(`Pages ${project.name} domains`, async () => save(`${base}/domains.json`, await list(`${prefix}/pages/projects/${project.name}/domains`)));
  console.log('Pages configuration exported:', project.name);
}

for (const database of selectedDatabases) {
  const file = `d1/${database.name}.sql`;
  const item = { name: database.name, id: database.uuid, exported: false };
  report.databases.push(item);
  await attempt(`D1 ${database.name}`, async () => {
    await fs.mkdir(path.join(output, 'd1'), { recursive: true });
    const { stdout, stderr } = await exec(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'export', database.uuid, '--remote', '--output', path.join(output, file)], { maxBuffer: 10 * 1024 * 1024 });
    await save(`d1/${database.name}.log`, stdout + stderr);
    item.exported = true;
    console.log('D1 exported:', database.name);
  });
}

for (const bucket of (bucketResult?.result?.buckets || []).filter(b => process.argv.includes('--transcribe-only') ? b.name === 'transcribe-recordings' : /zibuke/i.test(b.name))) {
  const item = { name: bucket.name, objects: 0, bytes: 0, complete: false };
  report.buckets.push(item);
  await attempt(`R2 ${bucket.name}`, async () => {
    let cursor = '';
    const objects = [];
    do {
      const data = await json(`${prefix}/r2/buckets/${encodeURIComponent(bucket.name)}/objects?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      const rows = Array.isArray(data.result) ? data.result : data.result?.objects;
      if (!Array.isArray(rows)) throw Error('Unexpected R2 listing response');
      objects.push(...rows);
      cursor = data.result_info?.cursor || data.result?.cursor || '';
    } while (cursor);
    await save(`r2/${bucket.name}/inventory.json`, objects);
    for (const object of objects) {
      const key = object.key || object.name;
      const filename = createHash('sha256').update(key).digest('hex');
      const response = await request(`${prefix}/r2/buckets/${encodeURIComponent(bucket.name)}/objects/${encodeURIComponent(key)}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await save(`r2/${bucket.name}/objects/${filename}`, bytes);
      object.backupFile = `objects/${filename}`;
      object.sha256 = createHash('sha256').update(bytes).digest('hex');
      item.objects++; item.bytes += bytes.length;
    }
    await save(`r2/${bucket.name}/inventory.json`, objects);
    item.complete = true;
    console.log('R2 exported:', bucket.name, item.objects, 'objects');
  });
}
report.finishedAt = new Date().toISOString();
await save('report.json', report);
console.log('Cloud export finished:', output);
