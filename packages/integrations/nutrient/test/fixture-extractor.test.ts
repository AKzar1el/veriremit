import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExtractedDocument } from '@veriremit/domain';

async function loadFixtureExtractor() {
  return import('../src/fixture-extractor.ts').catch(() => ({} as Record<string, unknown>));
}

test('returns only the requested synthetic document and forces fixture mode', async () => {
  const module = await loadFixtureExtractor();
  assert.equal(typeof module.FixtureDocumentExtractor, 'function');
  assert.equal(module.FIXTURE_MODE_LABEL, 'DEMO FIXTURE MODE');

  const document: ExtractedDocument = {
    id: 'doc_fixture',
    kind: 'current_invoice',
    filename: 'invoice-8842.pdf',
    facts: [],
    mode: 'live',
  };
  const extractor = new (module.FixtureDocumentExtractor as new (documents: readonly ExtractedDocument[]) => {
    extract(input: unknown): Promise<ExtractedDocument>;
  })([document]);

  const result = await extractor.extract({
    filename: 'invoice-8842.pdf',
    bytes: new Uint8Array(),
    kind: 'current_invoice',
  });
  assert.equal(result.mode, 'fixture');
  assert.equal(result.filename, 'invoice-8842.pdf');
});

test('rejects fixture requests that do not exactly match kind and filename', async () => {
  const module = await loadFixtureExtractor();
  assert.equal(typeof module.FixtureDocumentExtractor, 'function');
  const extractor = new (module.FixtureDocumentExtractor as new (documents: readonly ExtractedDocument[]) => {
    extract(input: unknown): Promise<ExtractedDocument>;
  })([]);

  await assert.rejects(
    () => extractor.extract({ filename: 'missing.pdf', bytes: new Uint8Array(), kind: 'vendor_master' }),
    /No synthetic extraction fixture/,
  );
});
