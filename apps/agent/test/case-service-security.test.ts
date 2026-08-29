import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';
import { auditRepositoryWithEvents, changedBankCase, emptyAuditRepository, loadService, memoryCaseRepository } from './case-service-test-helpers.ts';

test('signing session URL is returned transiently but never persisted in the case repository', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('release_prepared');
  value.releaseDocument = { id: 'release-1', filename: 'release.pdf', provider: 'foxit' };
  const cases = memoryCaseRepository(value);
  const service = new (module.CaseService as new (deps: unknown) => {
    sign(caseId: string, input: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits: auditRepositoryWithEvents(value.id, [{ type: 'RELEASE_PREPARED', data: { documentId: 'release-1' } }]),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: {
      async createEnvelope() {
        return { envelopeId: '12345', status: 'pending', signingUrl: 'https://sign.example/secret-session' };
      },
      async getStatus() { throw new Error('unused'); },
    },
  });

  const returned = await service.sign(value.id, {
    folderName: 'release',
    filename: 'release.pdf',
    bytes: new Uint8Array([1]),
    signer: { firstName: 'Demo', lastName: 'Controller', email: 'reviewer@example.com' },
    signSuccessUrl: 'https://example.test/success',
    signDeclineUrl: 'https://example.test/declined',
  });
  const persisted = await cases.get(value.id);

  assert.equal(returned.signature?.signingUrl, 'https://sign.example/secret-session');
  assert.equal(persisted?.signature?.signingUrl, undefined);
});

test('recordReview rejects malformed human verification input before persistence', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');
  const value = changedBankCase('review_required');
  value.documents = [{
    id: 'doc_vendor_master', kind: 'vendor_master', filename: 'vendor-master.pdf', mode: 'fixture',
    facts: [{
      field: 'trusted_phone', value: '+49 30 555 0104', normalizedValue: '+49305550104', confidence: 0.99,
      source: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    }],
  }];
  const cases = memoryCaseRepository(value);
  const service = new (module.CaseService as new (deps: unknown) => {
    recordReview(caseId: string, verification: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });

  await assert.rejects(
    () => service.recordReview(value.id, {
      method: 'email_reply',
      trustedContactSource: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
      reference: '',
      reviewerName: '',
      result: 'confirmed',
      recordedAt: 'not-a-date',
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'INVALID_HUMAN_VERIFICATION');
      assert.equal((error as { statusCode?: number }).statusCode, 400);
      return true;
    },
  );
  assert.equal((await cases.get(value.id))?.status, 'review_required');
});

test('recordReview uses server time for the authoritative verification timestamp', async () => {
  const module = await loadService();
  const value = changedBankCase('review_required');
  value.documents = [{
    id: 'doc_vendor_master', kind: 'vendor_master', filename: 'vendor-master.pdf', mode: 'fixture',
    facts: [{
      field: 'trusted_phone', value: '+49 30 555 0104', normalizedValue: '+49305550104', confidence: 0.99,
      source: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    }],
  }];
  const service = new (module.CaseService as new (deps: unknown) => {
    recordReview(caseId: string, verification: unknown): Promise<VerificationCase>;
  })({
    cases: memoryCaseRepository(value),
    audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
    now: () => '2026-08-29T12:34:56.000Z',
  });
  const approved = await service.recordReview(value.id, {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'doc_vendor_master', filename: 'vendor-master.pdf', page: 1 },
    reference: 'VR-2026-4821',
    reviewerName: 'Demo Controller',
    result: 'confirmed',
    recordedAt: '1999-01-01T00:00:00.000Z',
  });
  assert.equal(approved.humanVerification?.recordedAt, '2026-08-29T12:34:56.000Z');
  assert.equal(approved.updatedAt, '2026-08-29T12:34:56.000Z');
});

test('prepareRelease rejects approved case state that is not backed by an approval audit event', async () => {
  const module = await loadService();
  const { evaluatePacket } = await import('@veriremit/policy');
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile('fixtures/acme-components/fixture-extraction.json', 'utf8')) as {
    documents: VerificationCase['documents'];
  };
  const vendorSource = fixture.documents.find((document) => document.kind === 'vendor_master')!
    .facts.find((fact) => fact.field === 'trusted_phone')!.source;
  const value: VerificationCase = {
    ...changedBankCase('human_approved'),
    documents: fixture.documents,
    rules: evaluatePacket({ documents: fixture.documents }),
    humanVerification: {
      method: 'trusted_callback', trustedContactSource: vendorSource, reference: 'VR-2026-4821',
      reviewerName: 'Demo Controller', result: 'confirmed', recordedAt: '2026-08-29T01:00:00.000Z',
    },
  };
  let releaseCalls = 0;
  const service = new (module.CaseService as new (deps: unknown) => {
    prepareRelease(caseId: string, input: unknown): Promise<VerificationCase>;
  })({
    cases: memoryCaseRepository(value),
    audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { releaseCalls += 1; return { id: 'r', filename: 'r.pdf', provider: 'foxit', localPath: '/tmp/r.pdf' }; } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });
  await assert.rejects(
    () => service.prepareRelease(value.id, { releaseHtml: '<p>x</p>', evidenceDocuments: [], outputPath: '/tmp/r.pdf' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'AUDIT_STATE_MISMATCH');
      return true;
    },
  );
  assert.equal(releaseCalls, 0);
});

test('sign rejects release_prepared case state that lacks a matching release audit event', async () => {
  const module = await loadService();
  const value = changedBankCase('release_prepared');
  value.releaseDocument = { id: 'release-1', filename: 'release.pdf', provider: 'foxit' };
  let signCalls = 0;
  const service = new (module.CaseService as new (deps: unknown) => { sign(caseId: string, input: unknown): Promise<VerificationCase> })({
    cases: memoryCaseRepository(value), audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { signCalls += 1; return { envelopeId: '1', status: 'pending' }; }, async getStatus() { throw new Error('unused'); } },
  });
  await assert.rejects(
    () => service.sign(value.id, { folderName: 'x', filename: 'release.pdf', bytes: new Uint8Array([1]), signer: { firstName: 'D', lastName: 'C', email: 'x@example.com' }, signSuccessUrl: 'https://x/s', signDeclineUrl: 'https://x/d' }),
    (error: unknown) => { assert.equal((error as { code?: string }).code, 'AUDIT_STATE_MISMATCH'); return true; },
  );
  assert.equal(signCalls, 0);
});

test('refreshSignature rejects a pending envelope that lacks a matching eSign audit event', async () => {
  const module = await loadService();
  const value = changedBankCase('signature_pending');
  value.signature = { envelopeId: '123', status: 'pending' };
  value.releaseDocument = { id: 'release-1', filename: 'release.pdf', provider: 'foxit' };
  let statusCalls = 0;
  const service = new (module.CaseService as new (deps: unknown) => { refreshSignature(caseId: string): Promise<VerificationCase> })({
    cases: memoryCaseRepository(value), audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { statusCalls += 1; return { envelopeId: '123', status: 'completed' }; } },
  });
  await assert.rejects(
    () => service.refreshSignature(value.id),
    (error: unknown) => { assert.equal((error as { code?: string }).code, 'AUDIT_STATE_MISMATCH'); return true; },
  );
  assert.equal(statusCalls, 0);
});
