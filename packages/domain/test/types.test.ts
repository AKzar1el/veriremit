import assert from 'node:assert/strict';
import test from 'node:test';

test('domain exposes a case-status assertion that rejects unknown states', async () => {
  const domain = await import('../src/index.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof domain.assertCaseStatus, 'function');
  assert.throws(
    () => (domain.assertCaseStatus as (value: string) => void)('paid'),
    /invalid case status/i,
  );
});
