import assert from 'node:assert/strict';
import test from 'node:test';

async function loadPolicy() {
  return import('../src/index.ts').catch(() => ({} as Record<string, unknown>));
}

test('normalizes IBAN by removing whitespace and uppercasing', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.normalizeIban, 'function');
  assert.equal(
    (policy.normalizeIban as (value: string) => string)(' de89 3704 0044 0532 '),
    'DE89370400440532',
  );
});

test('normalizes money to exactly two decimals without float arithmetic', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.normalizeMoney, 'function');
  const normalizeMoney = policy.normalizeMoney as (value: string | number) => string;
  assert.equal(normalizeMoney('48620'), '48620.00');
  assert.equal(normalizeMoney('48620.0'), '48620.00');
  assert.equal(normalizeMoney('48620.00'), '48620.00');
});

test('rejects money with more than two fractional digits instead of rounding', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.normalizeMoney, 'function');
  assert.throws(
    () => (policy.normalizeMoney as (value: string) => string)('48620.001'),
    /more than two decimal places/i,
  );
});
