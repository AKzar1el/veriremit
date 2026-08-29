import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';
import { appendEvent } from '@veriremit/audit';
import { auditRepositoryWithEvents, changedBankCase, emptyAuditRepository, loadService, memoryCaseRepository } from './case-service-test-helpers.ts';

test('failed extraction leaves the case retryable and records a sanitized failure event', async () => {
  const module = await loadService();
  const value = { ...changedBankCase('created'), rules: [] };
  const cases = memoryCaseRepository(value);
  const audits = emptyAuditRepository();
  let calls = 0;
  const service = new (module.CaseService as new (deps: unknown) => {
    extract(caseId: string, inputs: unknown[]): Promise<VerificationCase>;
  })({
    cases,
    audits,
    extractor: {
      async extract() {
        calls += 1;
        throw new Error('upstream secret response must not be logged');
      },
    },
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: { async createEnvelope() { throw new Error('unused'); }, async getStatus() { throw new Error('unused'); } },
  });
  await assert.rejects(() => service.extract(value.id, [{ kind: 'vendor_master', filename: 'vendor.pdf', bytes: new Uint8Array([1]) }]));
  assert.equal(calls, 1);
  assert.equal((await cases.get(value.id))?.status, 'created');
  const ledger = await audits.get();
  const failure = ledger.find((event: any) => event.type === 'EXTRACTION_FAILED');
  assert.ok(failure);
  assert.equal(JSON.stringify(failure).includes('upstream secret'), false);
});

test('audit persistence failure during rule evaluation does not publish review_required case state', async () => {
  const module = await loadService();
  const value = { ...changedBankCase('created'), rules: [] };
  const cases = memoryCaseRepository(value);
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(
    await readFile('fixtures/acme-components/fixture-extraction.json', 'utf8'),
  ) as { documents: VerificationCase['documents'] };
  const { FixtureDocumentExtractor } = await import(
    '../../../packages/integrations/nutrient/src/fixture-extractor.ts'
  );

  let ledger: ReturnType<typeof appendEvent>[] = [];
  const audits = {
    async get() { return structuredClone(ledger); },
    async save(_caseId: string, next: ReturnType<typeof appendEvent>[]) {
      if (next.at(-1)?.type === 'RULE_EVALUATED') {
        throw new Error('audit storage unavailable');
      }
      ledger = structuredClone(next);
    },
  };

  const service = new (module.CaseService as new (deps: unknown) => {
    extract(caseId: string, inputs: unknown[]): Promise<VerificationCase>;
  })({
    cases,
    audits,
    extractor: new FixtureDocumentExtractor(fixture.documents),
    releaseGateway: { async prepare() { throw new Error('unused'); } },
    signatureGateway: {
      async createEnvelope() { throw new Error('unused'); },
      async getStatus() { throw new Error('unused'); },
    },
  });

  await assert.rejects(
    () => service.extract(value.id, fixture.documents.map((document) => ({
      kind: document.kind,
      filename: document.filename,
      bytes: new Uint8Array([1]),
    }))),
    /audit storage unavailable/,
  );

  assert.equal((await cases.get(value.id))?.status, 'created');
  assert.equal((await cases.get(value.id))?.rules.length, 0);
});
