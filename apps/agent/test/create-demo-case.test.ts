import assert from 'node:assert/strict';
import test from 'node:test';

test('demo case uses only synthetic ACME identifiers and starts created', async () => {
  const mod = await import('../src/demo/create-demo-case.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof mod.createDemoCase, 'function');
  const value = (mod.createDemoCase as (now?: string) => any)('2026-08-29T00:00:00.000Z');
  assert.equal(value.status, 'created');
  assert.equal(value.id, 'case_acme_po_4821');
  assert.equal(value.documents.length, 0);
  assert.equal(value.humanVerification, null);
});
