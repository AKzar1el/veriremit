import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';
import { auditRepositoryWithEvents, changedBankCase, emptyAuditRepository, loadService, memoryCaseRepository } from './case-service-test-helpers.ts';

test('prepareRelease denies an unapproved changed-bank case before Foxit MCP is called', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');
  assert.equal(typeof module.CaseServiceError, 'function');

  let releaseCalls = 0;
  const service = new (module.CaseService as new (deps: unknown) => {
    prepareRelease(caseId: string, input: unknown): Promise<unknown>;
  })({
    cases: memoryCaseRepository(changedBankCase()),
    audits: emptyAuditRepository(),
    releaseGateway: {
      async prepare() {
        releaseCalls += 1;
        return { id: 'should-not-exist', filename: 'x.pdf', provider: 'foxit', localPath: '/tmp/x.pdf' };
      },
    },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
    now: () => '2026-08-29T01:00:00.000Z',
  });

  await assert.rejects(
    () => service.prepareRelease('case_acme_po_4821', {
      releaseHtml: '<h1>Release</h1>',
      evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([1]) }],
      outputPath: '/tmp/release.pdf',
    }),
    (error: unknown) => {
      assert.equal(error instanceof (module.CaseServiceError as new (...args: never[]) => Error), true);
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      assert.equal((error as { code?: string }).code, 'RELEASE_BLOCKED');
      return true;
    },
  );
  assert.equal(releaseCalls, 0);
});

test('sign denies a case with no prepared release before Foxit eSign is called', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  let signCalls = 0;
  const caseValue = changedBankCase('human_approved');
  caseValue.humanVerification = {
    method: 'trusted_callback',
    trustedContactSource: { documentId: 'vendor-master', filename: 'vendor-master.pdf' },
    reference: 'VR-1',
    reviewerName: 'Demo Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T00:30:00.000Z',
  };

  const service = new (module.CaseService as new (deps: unknown) => {
    sign(caseId: string, input: unknown): Promise<unknown>;
  })({
    cases: memoryCaseRepository(caseValue),
    audits: emptyAuditRepository(),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: {
      async createEnvelope() { signCalls += 1; return { envelopeId: 'bad', status: 'pending' }; },
      async getStatus() { throw new Error('unused'); },
    },
    now: () => '2026-08-29T01:00:00.000Z',
  });

  await assert.rejects(
    () => service.sign('case_acme_po_4821', {
      folderName: 'release',
      filename: 'release.pdf',
      bytes: new Uint8Array([1]),
      signer: { firstName: 'Demo', lastName: 'Controller', email: 'reviewer@example.com' },
      signSuccessUrl: 'https://example.test/success',
      signDeclineUrl: 'https://example.test/declined',
    }),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      assert.equal((error as { code?: string }).code, 'SIGNATURE_BLOCKED');
      return true;
    },
  );
  assert.equal(signCalls, 0);
});

test('fixture extraction evaluates deterministic rules and trusted callback unlocks only the bank-change exception', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(
    await readFile('fixtures/acme-components/fixture-extraction.json', 'utf8'),
  ) as { documents: VerificationCase['documents'] };
  const { FixtureDocumentExtractor } = await import(
    '../../../packages/integrations/nutrient/src/fixture-extractor.ts'
  );

  const cases = memoryCaseRepository({
    ...changedBankCase('created'),
    rules: [],
  });
  const audits = emptyAuditRepository();
  const extractor = new FixtureDocumentExtractor(fixture.documents);

  const service = new (module.CaseService as new (deps: unknown) => {
    extract(caseId: string, documents: unknown[]): Promise<VerificationCase>;
    recordReview(caseId: string, verification: unknown): Promise<VerificationCase>;
  })({
    cases,
    audits,
    extractor,
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
    now: () => '2026-08-29T01:00:00.000Z',
  });

  const extracted = await service.extract('case_acme_po_4821', fixture.documents.map((document) => ({
    kind: document.kind,
    filename: document.filename,
    bytes: new Uint8Array([1]),
  })));

  assert.equal(extracted.status, 'review_required');
  assert.equal(extracted.documents.length, 5);
  assert.equal(extracted.rules.length, 10);
  assert.equal(
    extracted.rules.find((rule) => rule.code === 'bank_account_continuity')?.outcome,
    'BLOCK',
  );
  assert.equal(
    extracted.rules.filter((rule) => rule.code !== 'bank_account_continuity').every((rule) => rule.outcome === 'PASS'),
    true,
  );

  const trustedPhone = extracted.documents
    .find((document) => document.kind === 'vendor_master')
    ?.facts.find((fact) => fact.field === 'trusted_phone');
  assert.ok(trustedPhone);

  const approved = await service.recordReview('case_acme_po_4821', {
    method: 'trusted_callback',
    trustedContactSource: trustedPhone.source,
    reference: 'VR-2026-4821',
    reviewerName: 'Demo Finance Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T01:05:00.000Z',
  });

  assert.equal(approved.status, 'human_approved');
  assert.equal(approved.humanVerification?.reference, 'VR-2026-4821');

  const ledger = await audits.get();
  const types = ledger.map((event: any) => event.type);
  assert.ok(types.includes('EXTRACTION_STARTED'));
  assert.ok(types.includes('RULE_EVALUATED'));
  assert.ok(types.includes('EXCEPTION_RAISED'));
  assert.ok(types.includes('HUMAN_VERIFICATION_RECORDED'));
  assert.ok(types.includes('APPROVAL_GRANTED'));
});

test('a corrupt audit ledger disables release before Foxit MCP is called', async () => {
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

  let releaseCalls = 0;
  const audits = {
    async get() {
      return [{
        type: 'CASE_CREATED',
        caseId: value.id,
        occurredAt: '2026-08-29T00:00:00.000Z',
        data: {},
        previousHash: '0'.repeat(64),
        hash: 'tampered',
      }];
    },
    async save() {},
  };

  const service = new (module.CaseService as new (deps: unknown) => {
    prepareRelease(caseId: string, input: unknown): Promise<unknown>;
  })({
    cases: memoryCaseRepository(value),
    audits,
    releaseGateway: {
      async prepare() {
        releaseCalls += 1;
        return { id: 'bad', filename: 'bad.pdf', provider: 'foxit', localPath: '/tmp/bad.pdf' };
      },
    },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });

  await assert.rejects(
    () => service.prepareRelease(value.id, {
      releaseHtml: '<h1>Release</h1>',
      evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([1]) }],
      outputPath: '/tmp/release.pdf',
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'AUDIT_INVALID');
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      return true;
    },
  );
  assert.equal(releaseCalls, 0);
});

test('recordReview rejects a callback source that is not the verified vendor-master contact', async () => {
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
      source: {
        documentId: 'doc_vendor_master',
        filename: 'vendor-master.pdf',
        page: 1,
        text: '+49 30 555 0104',
      },
    }],
  }, {
    id: 'doc_bank_change',
    kind: 'bank_change_letter',
    filename: 'bank-change-letter.pdf',
    mode: 'fixture',
    facts: [{
      field: 'trusted_phone',
      value: '+49 30 555 9999',
      normalizedValue: '+49305559999',
      confidence: 0.99,
      source: {
        documentId: 'doc_bank_change',
        filename: 'bank-change-letter.pdf',
        page: 1,
        text: '+49 30 555 9999',
      },
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
      method: 'trusted_callback',
      trustedContactSource: {
        documentId: 'doc_bank_change',
        filename: 'bank-change-letter.pdf',
        page: 1,
      },
      reference: 'VR-BAD',
      reviewerName: 'Demo Finance Controller',
      result: 'confirmed',
      recordedAt: '2026-08-29T01:05:00.000Z',
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'UNTRUSTED_CONTACT_SOURCE');
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      return true;
    },
  );

  assert.equal((await cases.get(value.id))?.status, 'review_required');
});

test('refreshSignature authorizes release only after Foxit reports completed', async () => {
  const module = await loadService();
  assert.equal(typeof module.CaseService, 'function');

  const value = changedBankCase('signature_pending');
  value.releaseDocument = { id: 'foxit-release-1', filename: 'release.pdf', provider: 'foxit' };
  value.signature = { envelopeId: 'env-1', status: 'pending' };
  const cases = memoryCaseRepository(value);
  const audits = auditRepositoryWithEvents(value.id, [{ type: 'ESIGN_ENVELOPE_CREATED', data: { envelopeId: 'env-1' } }]);
  let statusCalls = 0;

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
        assert.equal(envelopeId, 'env-1');
        return { envelopeId, status: 'completed' };
      },
    },
    now: () => '2026-08-29T01:20:00.000Z',
  });

  const refreshed = await service.refreshSignature(value.id);
  assert.equal(refreshed.status, 'release_authorized');
  assert.equal(refreshed.signature?.status, 'completed');
  assert.equal(statusCalls, 1);
  const ledger = await audits.get();
  assert.equal(ledger.at(-1)?.type, 'SIGNATURE_COMPLETED');
});
