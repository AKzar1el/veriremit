import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '../src/index.ts';

function caseWith(status: VerificationCase['status']): VerificationCase {
  return {
    id: 'case_demo',
    status,
    documents: [],
    rules: [],
    humanVerification: null,
    releaseDocument: null,
    signature: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
}

test('cannot jump from review_required directly to release_prepared', async () => {
  const domain = await import('../src/index.ts');
  assert.equal(typeof domain.transitionCase, 'function');
  assert.throws(
    () => domain.transitionCase(caseWith('review_required'), 'release_prepared', '2026-08-29T00:01:00.000Z'),
    /invalid case transition/i,
  );
});

test('confirmed trusted callback moves a review-required case to human_approved', async () => {
  const domain = await import('../src/index.ts');
  assert.equal(typeof domain.recordHumanVerification, 'function');
  const next = domain.recordHumanVerification(
    caseWith('review_required'),
    {
      method: 'trusted_callback',
      trustedContactSource: {
        documentId: 'vendor-master',
        filename: 'vendor-master.pdf',
        page: 1,
      },
      reference: 'VR-2026-4821',
      reviewerName: 'Demo Finance Controller',
      result: 'confirmed',
      recordedAt: '2026-08-29T00:02:00.000Z',
    },
  );
  assert.equal(next.status, 'human_approved');
});
