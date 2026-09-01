import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditRepositoryWithEvents,
  changedBankCase,
  loadService,
  memoryCaseRepository,
} from './case-service-test-helpers.ts';

test('release gate passes structured data to the provider chain and audits Doctavian before Foxit', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const approved = changedBankCase('human_approved');
  approved.humanVerification = {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'vendor-master', filename: 'vendor-master.pdf', page: 1 },
    reference: 'VR-LIVE-4821',
    reviewerName: 'Demo Controller',
    result: 'confirmed',
    recordedAt: '2026-09-01T12:00:00.000Z',
  };
  const cases = memoryCaseRepository(approved);
  const audits = auditRepositoryWithEvents(approved.id, [
    { type: 'APPROVAL_GRANTED', data: { reference: 'VR-LIVE-4821' } },
  ]);
  let received: any;
  const service = new (module.CaseService as new (deps: any) => any)({
    cases,
    audits,
    releaseGateway: {
      async prepare(input: unknown) {
        received = input;
        return {
          id: 'foxit-merged-id',
          filename: 'payment-release-authorization.pdf',
          provider: 'foxit' as const,
          localPath: '/tmp/release.pdf',
          generation: {
            id: 'doctavian-generated-urn',
            filename: 'doctavian-payment-release-authorization.pdf',
            provider: 'doctavian' as const,
          },
        };
      },
    },
    signatureGateway: {
      async createEnvelope() { throw new Error('not used'); },
      async getStatus() { throw new Error('not used'); },
    },
    now: () => '2026-09-01T12:01:00.000Z',
  });

  const releaseData = {
    Release: {
      CaseId: approved.id,
      Supplier: 'ACME Components GmbH',
      Checks: [{ Code: 'bank_account_continuity', Outcome: 'PASS', Summary: 'Trusted callback confirmed' }],
    },
  };
  const result = await service.prepareRelease(approved.id, {
    releaseHtml: '<h1>fallback</h1>',
    releaseData,
    evidenceDocuments: [{ filename: 'vendor-master.pdf', bytes: new Uint8Array([1]) }],
    outputPath: '/tmp/release.pdf',
  });

  assert.deepEqual(received.releaseData, releaseData);
  assert.equal(result.status, 'release_prepared');
  const ledger = await audits.get();
  const types = ledger.map((event: { type: string }) => event.type);
  const doctavianIndex = types.indexOf('DOCTAVIAN_DOCUMENT_GENERATED');
  const foxitIndex = types.indexOf('FOXIT_MCP_OPERATION_COMPLETED');
  const releaseIndex = types.indexOf('RELEASE_PREPARED');
  assert.ok(doctavianIndex >= 0);
  assert.ok(foxitIndex > doctavianIndex);
  assert.ok(releaseIndex > foxitIndex);

  const doctavianEvent = ledger[doctavianIndex] as { data: Record<string, unknown> };
  assert.deepEqual(doctavianEvent.data, {
    documentId: 'doctavian-generated-urn',
    filename: 'doctavian-payment-release-authorization.pdf',
  });
});
