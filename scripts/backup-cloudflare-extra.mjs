import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const output = path.resolve(process.argv[2]);
const account = '59d043a264dc6132d6feb01884cf2533';
const auth = JSON.parse((await promisify(execFile)(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'auth', 'token', '--json'])).stdout);
const headers = { Authorization: `Bearer ${auth.token}` };
const inventory = JSON.parse(await fs.readFile(path.join(output, 'inventory.json'), 'utf8'));
const report = { pages: [], kv: [], queues: [], gaps: [] };
async function save(file, data) {
  const dest = path.resolve(output, file);
  if (!dest.startsWith(output + path.sep)) throw Error('Unsafe path');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
}
async function api(endpoint) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${endpoint}`, { headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) { await response.body?.cancel(); throw Error(`HTTP ${response.status}: ${endpoint}`); }
  return response;
}
async function attempt(resource, fn) {
  try { return await fn(); } catch(error) { report.gaps.push({ resource, error: error.message }); console.log('Export gap:', resource, error.message); }
}
const namespaces = new Set();
for (const project of inventory.pages.filter(p => /zibuke/i.test(p.name))) {
  for (const config of Object.values(project.deployment_configs || {})) {
    for (const value of Object.values(config.kv_namespaces || {})) if (value.namespace_id) namespaces.add(value.namespace_id);
  }
  const item = { name: project.name, publicFiles: 0, snapshotCompleteSource: false, failures: [] };
  report.pages.push(item);
  // Pages' underlying function script may be downloadable on some accounts.
  if (project.production_script_name) await attempt(`${project.name} Pages function code`, async () => {
    const response = await api(`/workers/scripts/${encodeURIComponent(project.production_script_name)}`);
    await save(`pages/${project.name}/function.raw`, Buffer.from(await response.arrayBuffer()));
    await save(`pages/${project.name}/function-headers.json`, Object.fromEntries(response.headers));
    item.functionDownloaded = true;
  });
  const origin = `https://${project.subdomain}`;
  const queue = ['/', '/robots.txt', '/sitemap.xml'];
  const queued = new Set(queue);
  const files = [];
  function add(value, base) {
    try {
      const url = new URL(value.replaceAll('&amp;', '&'), base);
      if (url.origin !== origin || url.search || /\/(?:api|logout|signout)(?:\/|$)/i.test(url.pathname)) return;
      const key = url.pathname;
      if (!queued.has(key)) { queued.add(key); queue.push(key); }
    } catch { /* Not a URL. */ }
  }
  while (queue.length && files.length < 5000) {
    const batch = queue.splice(0, 6);
    await Promise.all(batch.map(async pathname => {
      const url = origin + pathname;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'follow' });
        if (!response.ok) { item.failures.push({ path: pathname, status: response.status }); await response.body?.cancel(); return; }
        const bytes = Buffer.from(await response.arrayBuffer());
        const type = response.headers.get('content-type') || '';
        const file = `public-snapshot/files/${createHash('sha256').update(pathname).digest('hex')}`;
        await save(`pages/${project.name}/${file}`, bytes);
        files.push({ path: pathname, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: type, finalUrl: response.url });
        if (/text\/html|text\/css|javascript|xml/.test(type)) {
          const text = bytes.toString('utf8');
          for (const match of text.matchAll(/(?:href|src|poster)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^\s)"']+)|<loc>([^<]+)<\/loc>/gi)) add(match[1] || match[2] || match[3], url);
          if (/javascript/.test(type)) for (const match of text.matchAll(/["']((?:\.\/|\/)?[^"'\s<>]+\.(?:js|css|png|jpg|jpeg|webp|svg|woff2|ico))["']/g)) add(match[1], url);
        }
      } catch(error) { item.failures.push({ path: pathname, error: error.message }); }
    }));
  }
  item.publicFiles = files.length;
  item.remainingUrls = queue.length;
  await save(`pages/${project.name}/public-snapshot/manifest.json`, files);
  console.log('Pages public snapshot:', project.name, files.length, 'files');
  await save('supplemental-report.json', report);
}
for (const id of namespaces) {
  await attempt(`KV ${id}`, async () => {
    let cursor = '';
    const keys = [];
    do {
      const data = await (await api(`/storage/kv/namespaces/${id}/keys?limit=1000${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`)).json();
      keys.push(...data.result);
      cursor = data.result_info?.cursor || '';
    } while(cursor);
    for (const key of keys) {
      const response = await api(`/storage/kv/namespaces/${id}/values/${encodeURIComponent(key.name)}`);
      key.backupFile = `values/${createHash('sha256').update(key.name).digest('hex')}`;
      await save(`kv/${id}/${key.backupFile}`, Buffer.from(await response.arrayBuffer()));
    }
    await save(`kv/${id}/keys.json`, keys);
    report.kv.push({ id, keys: keys.length });
    console.log('KV exported:', id, keys.length, 'keys');
  });
}
await attempt('Queue configuration', async () => {
  const data = await (await api('/queues?per_page=100')).json();
  const queues = data.result.filter(q => /zibuke|transcribe|broadcast|delivery/i.test(q.queue_name));
  await save('queues.json', queues);
  report.queues = queues.map(q => q.queue_name);
});
await save('supplemental-report.json', report);
