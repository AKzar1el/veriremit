import assert from 'node:assert/strict';
import test from 'node:test';

async function loadConfig() {
  return import('../src/config.ts').catch(() => ({} as Record<string, unknown>));
}

test('builds Foxit eSign config with current unified credential headers', async () => {
  const module = await loadConfig();
  assert.equal(typeof module.createFoxitEsignConfig, 'function');

  const config = (module.createFoxitEsignConfig as (input: unknown) => {
    baseUrl: string;
    headers: Record<string, string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
  });

  assert.equal(config.baseUrl, 'https://na1.fusion.foxit.com');
  assert.deepEqual(config.headers, {
    accept: 'application/json',
    'content-type': 'application/json',
    client_id: 'client-id',
    client_secret: 'client-secret',
  });
  assert.equal('authorization' in config.headers, false);
});

test('normalizes an explicitly overridden Foxit eSign host', async () => {
  const module = await loadConfig();
  assert.equal(typeof module.createFoxitEsignConfig, 'function');

  const config = (module.createFoxitEsignConfig as (input: unknown) => { baseUrl: string })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    baseUrl: 'https://legacy.example.invalid///',
  });

  assert.equal(config.baseUrl, 'https://legacy.example.invalid');
});
