import assert from 'node:assert/strict';
import test from 'node:test';

test('agent config defaults to fixture mode and rejects invalid ports/provider modes', async () => {
  const module = await import('../src/config.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.loadAgentConfig, 'function');
  const load = module.loadAgentConfig as (env: Record<string, string | undefined>) => any;

  const config = load({});
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8787);
  assert.equal(config.dataDir, '.data');
  assert.equal(config.providerMode, 'fixture');
  assert.equal(config.logger, true);

  assert.throws(() => load({ PORT: '0' }), /PORT/i);
  assert.throws(() => load({ PORT: 'abc' }), /PORT/i);
  assert.throws(() => load({ VERIREMIT_PROVIDER_MODE: 'pretend' }), /provider mode/i);
});

test('agent config keeps provider credentials optional in fixture mode and never normalizes their values', async () => {
  const module = await import('../src/config.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.loadAgentConfig, 'function');
  const load = module.loadAgentConfig as (env: Record<string, string | undefined>) => any;
  const config = load({
    VERIREMIT_PROVIDER_MODE: 'fixture',
    NUTRIENT_API_KEY: ' nutrient-key-with-spaces ',
    FOXIT_CLIENT_ID: 'foxit-id',
    FOXIT_CLIENT_SECRET: 'foxit-secret',
    VERIREMIT_SIGNER_EMAIL: 'reviewer@example.com',
    GROQ_API_KEY: 'gsk-test-value',
    DOCTAVIAN_API_KEY: 'doctavian-test-value',
    DOCTAVIAN_ACCESS_TOKEN: 'doctavian-bearer-value',
    DOCTAVIAN_API_BASE_URL: 'https://demo.api.doctavian.com',
  });
  assert.equal(config.nutrientApiKey, ' nutrient-key-with-spaces ');
  assert.equal(config.foxitClientId, 'foxit-id');
  assert.equal(config.foxitClientSecret, 'foxit-secret');
  assert.equal(config.signerEmail, 'reviewer@example.com');
  assert.equal(config.groqApiKey, 'gsk-test-value');
  assert.equal(config.doctavianApiKey, 'doctavian-test-value');
  assert.equal(config.doctavianAccessToken, 'doctavian-bearer-value');
  assert.equal(config.doctavianApiBaseUrl, 'https://demo.api.doctavian.com');
});

test('agent config accepts one explicit web origin for split frontend deployment', async () => {
  const module = await import('../src/config.ts').catch(() => ({} as Record<string, unknown>));
  const load = module.loadAgentConfig as (env: Record<string, string | undefined>) => any;
  const config = load({ VERIREMIT_WEB_ORIGIN: 'https://veriremit.example' });
  assert.equal(config.webOrigin, 'https://veriremit.example');
});
