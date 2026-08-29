import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentKind } from '@veriremit/domain';

const documentedResponse = {
  status: 200,
  requestId: 'sanitized-request',
  output: {
    data: {
      vendor_id: 'V-1042',
      iban: 'DE72 5001 0517 5407',
      amount: 48620,
    },
    metadata: {
      vendor_id: {
        bbox: { x: 1030, y: 302, width: 127, height: 22 },
        confidence: 0.95,
        match: 'id_match',
        pageIndex: 0,
        pageNumber: 1,
        source_bboxes: [
          {
            bbox: { x: 1029.7, y: 302, width: 127.6, height: 22 },
            block_id: 'b87',
            pageIndex: 0,
            pageNumber: 1,
          },
        ],
      },
      iban: {
        bbox: { x: 72, y: 330, width: 258, height: 20 },
        confidence: 0.98,
        match: 'id_match',
        pageIndex: 0,
        pageNumber: 1,
      },
      amount: {
        bbox: { x: 72, y: 270, width: 118, height: 20 },
        confidence: 0.97,
        match: 'id_match',
        pageIndex: 0,
        pageNumber: 1,
      },
    },
  },
};

async function loadMapper() {
  return import('../src/map-extraction.ts').catch(() => ({} as Record<string, unknown>));
}

test('maps Nutrient schema extraction values and provenance into provider-neutral facts', async () => {
  const module = await loadMapper();
  assert.equal(typeof module.mapNutrientExtraction, 'function');

  const result = (module.mapNutrientExtraction as (input: {
    response: unknown;
    documentId: string;
    filename: string;
    kind: DocumentKind;
  }) => {
    facts: Array<{
      field: string;
      value: string | number;
      confidence?: number;
      source: { page?: number; boundingBox?: readonly number[] };
    }>;
  })({
    response: documentedResponse,
    documentId: 'doc_invoice',
    filename: 'invoice-8842.pdf',
    kind: 'current_invoice',
  });

  assert.deepEqual(result.facts.find((fact) => fact.field === 'iban'), {
    field: 'iban',
    value: 'DE72 5001 0517 5407',
    normalizedValue: 'DE72 5001 0517 5407',
    confidence: 0.98,
    source: {
      documentId: 'doc_invoice',
      filename: 'invoice-8842.pdf',
      page: 1,
      boundingBox: [72, 330, 258, 20],
    },
  });
  assert.equal(result.mode, 'live');
  assert.equal('metadata' in result, false);
  assert.equal('requestId' in result, false);
});

test('fails closed when extraction data is not a flat primitive schema', async () => {
  const module = await loadMapper();
  assert.equal(typeof module.mapNutrientExtraction, 'function');
  assert.throws(
    () => (module.mapNutrientExtraction as (input: unknown) => unknown)({
      response: { status: 200, output: { data: { nested: { unsafe: true } }, metadata: {} } },
      documentId: 'doc_bad',
      filename: 'bad.pdf',
      kind: 'current_invoice',
    }),
    /flat primitive/i,
  );
});
