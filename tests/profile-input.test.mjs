import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfileInput, safeWebUrl } from '../lib/profile-input.ts';

function form(bio = ' Hello ', website = 'https://example.com', links = []) {
  const data = new FormData();
  data.set('bio', bio);
  data.set('websiteUrl', website);
  data.set('socialLinks', JSON.stringify(links));
  return data;
}

test('normalizes profile fields and supports clearing them', () => {
  assert.deepEqual(parseProfileInput(form(' Hello ', 'https://example.com', [{ platform: ' Instagram ', url: 'https://instagram.com/person' }])), {
    bio: 'Hello', websiteUrl: 'https://example.com/', socialLinks: { instagram: 'https://instagram.com/person' },
  });
  assert.deepEqual(parseProfileInput(form('', '', [])), { bio: null, websiteUrl: null, socialLinks: {} });
});
test('rejects dangerous protocols, embedded credentials and malformed URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@example.com', '/relative', 'not a URL']) {
    assert.equal(safeWebUrl(value), null);
    assert.throws(() => parseProfileInput(form('', value)));
  }
});
test('enforces lengths, social link limits, unique names and URL validation', () => {
  assert.throws(() => parseProfileInput(form('a'.repeat(1001))));
  assert.throws(() => parseProfileInput(form('', '', Array.from({ length: 11 }, (_, i) => ({ platform: `site${i}`, url: 'https://example.com' })))));
  assert.throws(() => parseProfileInput(form('', '', [{ platform: 'Facebook', url: 'https://example.com' }, { platform: 'facebook', url: 'https://example.com' }])));
  assert.throws(() => parseProfileInput(form('', '', [{ platform: '__proto__', url: 'https://example.com' }])));
  assert.throws(() => parseProfileInput(form('', '', [{ platform: 'instagram', url: 'javascript:alert(1)' }])));
  const malformed = form(); malformed.set('socialLinks', '{');
  assert.throws(() => parseProfileInput(malformed));
});
