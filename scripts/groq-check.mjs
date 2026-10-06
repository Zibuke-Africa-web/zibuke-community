// Usage: node scripts/groq-check.mjs https://your-community-host
// This calls the deployed route, not Groq directly, to verify its runtime binding.
const input = process.argv[2] || 'http://localhost:3000';
try {
  const base = new URL(input);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('INVALID_URL');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('HTTPS_REQUIRED');
  const url = new URL('/api/groq-check', base);
  url.searchParams.set('secret', 'zibuke-check');
  const response = await fetch(url, { signal: AbortSignal.timeout(40000), redirect: 'error', cache: 'no-store' });
  const data = await response.json();
  const passed = response.ok && data?.ok === true && data.keyBound === true && data.authenticated === true && data.vision?.ok === true;
  // Print only known fields. Never echo response bodies, URLs, keys or exceptions.
  console.log(`Groq health check: ${passed ? 'PASS' : 'FAIL'} (HTTP ${response.status})`);
  console.log(`Key available: ${data?.keyBound === true ? 'yes' : 'no'}`);
  console.log(`Key source: ${data?.keySource === 'cloudflare' ? 'Cloudflare binding' : data?.keySource === 'process.env' ? 'process.env fallback' : 'unavailable'}`);
  console.log(`Authenticated: ${data?.authenticated === true ? 'yes' : 'no'}`);
  console.log(`Vision inference: ${data?.vision?.ok === true ? 'passed' : 'not verified'}`);
  if (!passed) process.exitCode = 1;
} catch {
  console.error('Groq health check failed: check the server URL, runtime compatibility, connectivity and route configuration.');
  process.exitCode = 1;
}
