import assert from 'node:assert/strict';
import test from 'node:test';

async function loadAudit() {
  return import('../src/index.ts').catch(() => ({} as Record<string, unknown>));
}

test('canonical JSON is stable regardless of object key insertion order', async () => {
  const audit = await loadAudit();
  assert.equal(typeof audit.canonicalJson, 'function');
  const canonicalJson = audit.canonicalJson as (value: unknown) => string;
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(canonicalJson({ nested: { z: true, a: ['x', 1] } }), '{"nested":{"a":["x",1],"z":true}}');
});

test('ledger verification reports the first tampered event', async () => {
  const audit = await loadAudit();
  assert.equal(typeof audit.appendEvent, 'function');
  assert.equal(typeof audit.verifyLedger, 'function');

  const appendEvent = audit.appendEvent as (ledger: readonly unknown[], input: unknown) => unknown;
  const verifyLedger = audit.verifyLedger as (ledger: readonly unknown[]) => unknown;

  const first = appendEvent([], {
    type: 'CASE_CREATED',
    occurredAt: '2026-08-29T00:00:00.000Z',
    caseId: 'case_demo',
    data: { source: 'demo' },
  });
  const second = appendEvent([first], {
    type: 'RULE_EVALUATED',
    occurredAt: '2026-08-29T00:01:00.000Z',
    caseId: 'case_demo',
    data: { code: 'bank_account_continuity', outcome: 'BLOCK' },
  });

  const valid = [first, second] as Array<Record<string, unknown>>;
  assert.deepEqual(verifyLedger(valid), { valid: true });

  const tampered = valid.map((event, index) =>
    index === 1 ? { ...event, data: { code: 'bank_account_continuity', outcome: 'PASS' } } : event,
  );
  assert.deepEqual(verifyLedger(tampered), { valid: false, corruptIndex: 1 });
});
