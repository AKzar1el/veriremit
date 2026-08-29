import assert from 'node:assert/strict';
import test from 'node:test';

async function loadApiUrl() {
  return import('../src/api-url.ts').catch(() => ({} as Record<string, unknown>));
}

test('API URL resolver keeps same-origin paths by default and prefixes an explicit deployment origin', async () => {
  const module = await loadApiUrl();
  assert.equal(typeof module.resolveApiUrl, 'function');
  const resolveApiUrl = module.resolveApiUrl as (path: string, baseUrl?: string) => string;
  assert.equal(resolveApiUrl('/api/cases/demo'), '/api/cases/demo');
  assert.equal(resolveApiUrl('/api/cases/demo', 'https://agent.example/'), 'https://agent.example/api/cases/demo');
});
