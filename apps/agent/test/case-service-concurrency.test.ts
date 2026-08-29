import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';
import { auditRepositoryWithEvents, changedBankCase, emptyAuditRepository, loadService, memoryCaseRepository } from './case-service-test-helpers.ts';

test('concurrent signature requests create at most one Foxit envelope for a case', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('release_prepared');
  value.releaseDocument = { id: 'release-1', filename: 'release.pdf', provider: 'foxit' };
  const cases = memoryCaseRepository(value);
  let signCalls = 0;

  const service = new (module.CaseService as new (deps: unknown) => {
    sign(caseId: string, input: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits: auditRepositoryWithEvents(value.id, [{ type: 'RELEASE_PREPARED', data: { documentId: 'release-1' } }]),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: {
      async createEnvelope() {
        signCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { envelopeId: String(signCalls), status: 'pending' };
      },
      async getStatus() { throw new Error('unused'); },
    },
  });

  const input = {
    folderName: 'release',
    filename: 'release.pdf',
    bytes: new Uint8Array([1]),
    signer: { firstName: 'Demo', lastName: 'Controller', email: 'reviewer@example.com' },
    signSuccessUrl: 'https://example.test/success',
    signDeclineUrl: 'https://example.test/declined',
  };
  const results = await Promise.allSettled(
    Array.from({ length: 50 }, () => service.sign(value.id, input)),
  );

  assert.equal(signCalls, 1);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 49);
  assert.equal((await cases.get(value.id))?.status, 'signature_pending');
});

test('concurrent release preparation requests call Foxit MCP at most once for a case', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('human_approved');
  value.humanVerification = {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'vendor-master', filename: 'vendor-master.pdf' },
    reference: 'VR-1',
    reviewerName: 'Demo Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T00:30:00.000Z',
  };
  const cases = memoryCaseRepository(value);
  let releaseCalls = 0;
  const service = new (module.CaseService as new (deps: unknown) => {
    prepareRelease(caseId: string, input: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits: auditRepositoryWithEvents(value.id, [{ type: 'APPROVAL_GRANTED', data: { reference: 'VR-1' } }]),
    releaseGateway: {
      async prepare() {
        releaseCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id: 'release-1', filename: 'release.pdf', provider: 'foxit', localPath: '/tmp/release.pdf' };
      },
    },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });
  const input = {
    releaseHtml: '<h1>Release</h1>',
    evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([1]) }],
    outputPath: '/tmp/release.pdf',
  };

  const results = await Promise.allSettled([
    service.prepareRelease(value.id, input),
    service.prepareRelease(value.id, input),
  ]);

  assert.equal(releaseCalls, 1);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal((await cases.get(value.id))?.status, 'release_prepared');
});

test('concurrent extraction requests run the document provider only once for a new case', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(
    await readFile('fixtures/acme-components/fixture-extraction.json', 'utf8'),
  ) as { documents: VerificationCase['documents'] };

  const cases = memoryCaseRepository({ ...changedBankCase('created'), rules: [] });
  let extractCalls = 0;
  const byKind = new Map(fixture.documents.map((document) => [document.kind, document]));
  const service = new (module.CaseService as new (deps: unknown) => {
    extract(caseId: string, documents: unknown[]): Promise<VerificationCase>;
  })({
    cases,
    audits: emptyAuditRepository(),
    extractor: {
      async extract(input: { kind: VerificationCase['documents'][number]['kind'] }) {
        extractCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        const document = byKind.get(input.kind);
        if (!document) throw new Error('missing fixture');
        return structuredClone(document);
      },
    },
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });
  const inputs = fixture.documents.map((document) => ({
    kind: document.kind,
    filename: document.filename,
    bytes: new Uint8Array([1]),
  }));

  const results = await Promise.allSettled([
    service.extract('case_acme_po_4821', inputs),
    service.extract('case_acme_po_4821', inputs),
  ]);

  assert.equal(extractCalls, fixture.documents.length);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal((await cases.get('case_acme_po_4821'))?.status, 'review_required');
});

test('concurrent human review submissions record one approval transition for a case', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('review_required');
  value.documents = [{
    id: 'doc_vendor_master',
    kind: 'vendor_master',
    filename: 'vendor-master.pdf',
    mode: 'fixture',
    facts: [{
      field: 'trusted_phone',
      value: '+49 30 555 0104',
      normalizedValue: '+49305550104',
      confidence: 0.99,
      source: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    }],
  }];
  const cases = memoryCaseRepository(value);
  const audits = emptyAuditRepository();
  const service = new (module.CaseService as new (deps: unknown) => {
    recordReview(caseId: string, verification: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits,
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });
  const verification = {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    reference: 'VR-1',
    reviewerName: 'Demo Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T00:30:00.000Z',
  };

  const results = await Promise.allSettled([
    service.recordReview(value.id, verification),
    service.recordReview(value.id, verification),
  ]);
  const ledger = await audits.get();

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(ledger.filter((event: any) => event.type === 'APPROVAL_GRANTED').length, 1);
});

test('concurrent signature status refreshes record completion once', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('signature_pending');
  value.releaseDocument = { id: 'release-1', filename: 'release.pdf', provider: 'foxit' };
  value.signature = { envelopeId: '12345', status: 'pending' };
  const cases = memoryCaseRepository(value);
  let statusCalls = 0;
  const audits = auditRepositoryWithEvents(value.id, [{ type: 'ESIGN_ENVELOPE_CREATED', data: { envelopeId: '12345' } }]);
  const service = new (module.CaseService as new (deps: unknown) => {
    refreshSignature(caseId: string): Promise<VerificationCase>;
  })({
    cases,
    audits,
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: {
      async createEnvelope() { throw new Error('unused'); },
      async getStatus(envelopeId: string) {
        statusCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return { envelopeId, status: 'completed' };
      },
    },
  });

  const results = await Promise.allSettled([
    service.refreshSignature(value.id),
    service.refreshSignature(value.id),
  ]);
  const ledger = await audits.get();

  assert.equal(statusCalls, 1);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(ledger.filter((event: any) => event.type === 'SIGNATURE_COMPLETED').length, 1);
});
