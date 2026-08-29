import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';

async function loadViewModel() {
  return import('../src/view-model.ts').catch(() => ({} as Record<string, unknown>));
}

function caseWith(status: VerificationCase['status']): VerificationCase {
  return {
    id: 'case_acme_po_4821',
    status,
    documents: [
      {
        id: 'doc_vendor_master',
        kind: 'vendor_master',
        filename: 'vendor-master.pdf',
        mode: 'fixture',
        facts: [
          {
            field: 'iban',
            value: 'DE89 3704 0044 0532',
            normalizedValue: 'DE89370400440532',
            confidence: 0.99,
            source: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
          },
          {
            field: 'trusted_phone',
            value: '+49 30 555 0104',
            normalizedValue: '+49305550104',
            confidence: 0.99,
            source: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
          },
        ],
      },
      {
        id: 'doc_current_invoice',
        kind: 'current_invoice',
        filename: 'invoice-8842.pdf',
        mode: 'fixture',
        facts: [{
          field: 'iban',
          value: 'DE72 5001 0517 5407',
          normalizedValue: 'DE72500105175407',
          confidence: 0.99,
          source: { documentId: 'doc_current_invoice', filename: 'invoice-8842.pdf', page: 1 },
        }],
      },
    ],
    rules: [{
      code: 'bank_account_continuity',
      outcome: 'BLOCK',
      message: 'Current invoice bank account differs from verified history.',
      evidence: [],
    }],
    humanVerification: null,
    releaseDocument: null,
    signature: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
}

test('review-required bank change exposes masked old/new IBANs and only the trusted callback action', async () => {
  const module = await loadViewModel();
  assert.equal(typeof module.buildWorkbenchView, 'function');
  const view = (module.buildWorkbenchView as (value: VerificationCase) => any)(caseWith('review_required'));

  assert.equal(view.statusTone, 'blocked');
  assert.equal(view.bankChange.oldIban, 'DE89 •••• •••• 0532');
  assert.equal(view.bankChange.newIban, 'DE72 •••• •••• 5407');
  assert.equal(view.trustedPhone, '+49 30 555 0104');
  assert.equal(view.actions.recordReview, true);
  assert.equal(view.actions.prepareRelease, false);
  assert.equal(view.actions.sendForSignature, false);
  assert.equal(view.fixtureMode, true);
});

test('action progression follows authoritative case state without optimistic unlocks', async () => {
  const module = await loadViewModel();
  assert.equal(typeof module.buildWorkbenchView, 'function');
  const build = module.buildWorkbenchView as (value: VerificationCase) => any;

  const approved = caseWith('human_approved');
  approved.humanVerification = {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    reference: 'VR-2026-4821',
    reviewerName: 'Demo Finance Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T01:00:00.000Z',
  };
  assert.deepEqual(build(approved).actions, {
    runReview: false,
    recordReview: false,
    prepareRelease: true,
    sendForSignature: false,
    refreshSignature: false,
  });

  const prepared = structuredClone(approved);
  prepared.status = 'release_prepared';
  prepared.releaseDocument = { id: 'doc_release', filename: 'payment-release.pdf', provider: 'foxit' };
  assert.equal(build(prepared).actions.sendForSignature, true);
  assert.equal(build(prepared).actions.prepareRelease, false);

  const pending = structuredClone(prepared);
  pending.status = 'signature_pending';
  pending.signature = { envelopeId: 'env_1', status: 'pending', signingUrl: 'https://sign.example/session' };
  assert.equal(build(pending).actions.refreshSignature, true);
  assert.equal(build(pending).actions.sendForSignature, false);
  assert.equal(build(pending).signingUrl, 'https://sign.example/session');
});
