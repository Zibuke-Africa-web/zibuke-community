// Usage: node scripts/groq-check.mjs https://your-community-host
// This calls the deployed route, not Groq directly, to verify its runtime binding.
const input = process.argv[2] || 'http://localhost:3000';
try {
  const base = new URL(input);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('INVALID_URL');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('HTTPS_REQUIRED');
  const url = new URL('/api/groq-check', base);
  const cookie = process.env.GROQ_CHECK_COOKIE;
  if (!cookie) throw new Error('ADMIN_SESSION_REQUIRED');
  const response = await fetch(url, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(40000), redirect: 'error', cache: 'no-store' });
  const data = await response.json();
  const passed = response.ok && data?.ok === true && typeof data.model === 'string' && data.model.length > 0;
  // Print only known fields. Never echo response bodies, URLs, keys or exceptions.
  console.log(`Groq health check: ${passed ? 'PASS' : 'FAIL'} (HTTP ${response.status})`);
  console.log(`Text inference: ${passed ? 'passed' : 'not verified'}`);
  if (Number.isInteger(data?.groqStatus)) console.log(`Groq HTTP status: ${data.groqStatus}`);
  if (data?.groqStatus === 404) console.log('Configured model unavailable: check GROQ_TEXT_MODEL and Groq project model access.');
  console.log('Vision inference: not checked by this text-only probe');
  if (!passed) process.exitCode = 1;
} catch {
  console.error('Groq health check failed: check the server URL, runtime compatibility, connectivity and route configuration.');
  process.exitCode = 1;
}
