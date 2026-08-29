import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';
import { FixtureDocumentExtractor } from '../../packages/integrations/nutrient/src/fixture-extractor.ts';
import { CaseService } from '../../apps/agent/src/services/case-service.ts';

function memoryCaseRepository(initial: VerificationCase) {
  let value = structuredClone(initial);
  return {
    async create(next: VerificationCase) { value = structuredClone(next); },
    async get(id: string) { return id === value.id ? structuredClone(value) : null; },
    async save(next: VerificationCase) { value = structuredClone(next); },
  };
}

function memoryAuditRepository() {
  let ledger: any[] = [];
  return {
    async get() { return structuredClone(ledger); },
    async save(_caseId: string, next: any[]) { ledger = structuredClone(next); },
  };
}

test('generated packet follows changed-bank review -> trusted callback -> gated Foxit release preparation', async () => {
  const fixture = JSON.parse(
    await readFile('fixtures/acme-components/fixture-extraction.json', 'utf8'),
  ) as { documents: VerificationCase['documents'] };

  const initial: VerificationCase = {
    id: 'case_acme_po_4821',
    status: 'created',
    documents: [],
    rules: [],
    humanVerification: null,
    releaseDocument: null,
    signature: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };

  const cases = memoryCaseRepository(initial);
  const audits = memoryAuditRepository();
  const releaseInputs: any[] = [];
  const service = new CaseService({
    cases,
    audits,
    extractor: new FixtureDocumentExtractor(fixture.documents),
    releaseGateway: {
      async prepare(input) {
        releaseInputs.push(input);
        assert.match(input.releaseHtml, /PO-4821/);
        assert.equal(input.evidenceDocuments.length, 5);
        for (const document of input.evidenceDocuments) {
          assert.equal(Buffer.from(document.bytes).subarray(0, 5).toString('ascii'), '%PDF-');
        }
        return {
          id: 'foxit_release_demo_1',
          filename: 'payment-release-authorization.pdf',
          provider: 'foxit' as const,
          localPath: input.outputPath,
        };
      },
    },
    signatureGateway: {
      async createEnvelope() { throw new Error('signature is outside this integration test'); },
      async getStatus() { throw new Error('signature is outside this integration test'); },
    },
    now: () => '2026-08-29T02:00:00.000Z',
  });

  const extractionInputs = await Promise.all(fixture.documents.map(async (document) => ({
    kind: document.kind,
    filename: document.filename,
    bytes: new Uint8Array(await readFile(`fixtures/acme-components/${document.filename}`)),
  })));

  const reviewed = await service.extract(initial.id, extractionInputs);
  assert.equal(reviewed.status, 'review_required');
  assert.equal(reviewed.rules.find((rule) => rule.code === 'bank_account_continuity')?.outcome, 'BLOCK');
  assert.equal(reviewed.rules.filter((rule) => rule.code !== 'bank_account_continuity').every((rule) => rule.outcome === 'PASS'), true);

  const trustedPhone = reviewed.documents
    .find((document) => document.kind === 'vendor_master')
    ?.facts.find((fact) => fact.field === 'trusted_phone');
  assert.ok(trustedPhone);

  const approved = await service.recordReview(initial.id, {
    method: 'trusted_callback',
    trustedContactSource: trustedPhone.source,
    reference: 'VR-2026-4821',
    reviewerName: 'Demo Finance Controller',
    result: 'confirmed',
    recordedAt: '2026-08-29T02:05:00.000Z',
  });
  assert.equal(approved.status, 'human_approved');

  const prepared = await service.prepareRelease(initial.id, {
    releaseHtml: '<h1>Payment Release Authorization - PO-4821</h1><p>Human verification recorded.</p>',
    evidenceDocuments: extractionInputs.map((document) => ({
      filename: document.filename,
      bytes: document.bytes,
    })),
    outputPath: '/tmp/payment-release-authorization.pdf',
    outputFilename: 'payment-release-authorization.pdf',
  });

  assert.equal(prepared.status, 'release_prepared');
  assert.equal(prepared.releaseDocument?.provider, 'foxit');
  assert.equal(releaseInputs.length, 1);

  const auditTypes = (await audits.get()).map((event) => event.type);
  assert.ok(auditTypes.includes('EXCEPTION_RAISED'));
  assert.ok(auditTypes.includes('APPROVAL_GRANTED'));
  assert.ok(auditTypes.includes('FOXIT_MCP_OPERATION_COMPLETED'));
  assert.ok(auditTypes.includes('RELEASE_PREPARED'));
});
