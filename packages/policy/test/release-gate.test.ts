import assert from 'node:assert/strict';
import test from 'node:test';
import type { RuleResult, VerificationCase } from '@veriremit/domain';

const passRule = (code: RuleResult['code']): RuleResult => ({
  code,
  outcome: 'PASS',
  message: 'ok',
  evidence: [],
});

function baseRules(): RuleResult[] {
  return [
    passRule('vendor_id_match'),
    passRule('vat_id_match'),
    passRule('po_number_match'),
    passRule('currency_match'),
    passRule('invoice_amount_matches_po'),
    passRule('beneficiary_name_match'),
    passRule('bank_change_vendor_match'),
    passRule('bank_change_request_match'),
    {
      code: 'bank_account_continuity',
      outcome: 'BLOCK',
      message: 'changed',
      evidence: [],
    },
    passRule('critical_confidence_threshold'),
  ];
}

function makeCase(status: VerificationCase['status'], confirmed: boolean): VerificationCase {
  return {
    id: 'case_demo',
    status,
    documents: [],
    rules: baseRules(),
    humanVerification: confirmed
      ? {
          method: 'trusted_callback',
          trustedContactSource: { documentId: 'vendor-master', filename: 'vendor-master.pdf', page: 1 },
          reference: 'VR-2026-4821',
          reviewerName: 'Demo Finance Controller',
          result: 'confirmed',
          recordedAt: '2026-08-29T00:02:00.000Z',
        }
      : null,
    releaseDocument: null,
    signature: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:02:00.000Z',
  };
}

test('denies release while a changed bank account has no human verification', async () => {
  const policy = await import('../src/index.ts');
  assert.equal(typeof policy.evaluateReleaseGate, 'function');
  assert.equal(policy.evaluateReleaseGate(makeCase('review_required', false)).allowed, false);
});

test('allows a resolved bank-account change only after confirmed verification and human_approved state', async () => {
  const policy = await import('../src/index.ts');
  assert.equal(typeof policy.evaluateReleaseGate, 'function');
  assert.deepEqual(policy.evaluateReleaseGate(makeCase('human_approved', true)), {
    allowed: true,
    reasons: [],
  });
});

test('denies release when any non-bank hard block remains', async () => {
  const policy = await import('../src/index.ts');
  assert.equal(typeof policy.evaluateReleaseGate, 'function');
  const value = makeCase('human_approved', true);
  value.rules = value.rules.map((rule) =>
    rule.code === 'currency_match' ? { ...rule, outcome: 'BLOCK', message: 'currency mismatch' } : rule,
  );
  const decision = policy.evaluateReleaseGate(value);
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /currency_match/);
});

test('denies release when a required deterministic control is missing', async () => {
  const policy = await import('../src/index.ts');
  const value = makeCase('human_approved', true);
  value.rules = value.rules.filter((rule) => rule.code !== 'currency_match');
  const decision = policy.evaluateReleaseGate(value);
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /rules_missing:currency_match/);
});
