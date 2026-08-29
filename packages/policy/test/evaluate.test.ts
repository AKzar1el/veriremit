import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocumentKind, ExtractedDocument, ExtractedFact } from '@veriremit/domain';

function fact(
  field: string,
  value: string | number,
  confidence = 0.99,
  filename = 'fixture.pdf',
): ExtractedFact<string | number> {
  return {
    field,
    value,
    normalizedValue: String(value),
    confidence,
    source: { documentId: filename, filename, page: 1 },
  };
}

function doc(
  kind: DocumentKind,
  filename: string,
  values: Record<string, string | number>,
  confidence = 0.99,
): ExtractedDocument {
  return {
    id: kind,
    kind,
    filename,
    facts: Object.entries(values).map(([field, value]) => fact(field, value, confidence, filename)),
    mode: 'fixture',
  };
}

function packet(currentIban: string, confidence = 0.99) {
  return {
    documents: [
      doc('vendor_master', 'vendor-master.pdf', {
        vendor_id: 'V-1042',
        vat_id: 'DE123456789',
        beneficiary_name: 'ACME Components GmbH',
        iban: 'DE89 3704 0044 0532',
        trusted_phone: '+49 30 555 0104',
      }),
      doc('purchase_order', 'purchase-order-4821.pdf', {
        po_number: 'PO-4821',
        vendor_id: 'V-1042',
        currency: 'EUR',
        amount: '48620.00',
      }),
      doc('previous_invoice', 'previous-invoice.pdf', {
        vendor_id: 'V-1042',
        vat_id: 'DE123456789',
        beneficiary_name: 'ACME Components GmbH',
        iban: 'DE89 3704 0044 0532',
      }),
      doc('current_invoice', 'invoice-8842.pdf', {
        vendor_id: 'V-1042',
        vat_id: 'DE123456789',
        po_number: 'PO-4821',
        currency: 'EUR',
        amount: '48620.00',
        beneficiary_name: 'ACME Components GmbH',
        iban: currentIban,
      }, confidence),
    ],
  };
}

async function loadPolicy() {
  return import('../src/index.ts').catch(() => ({} as Record<string, unknown>));
}

test('hard-blocks a changed bank account even when commercial data matches', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.evaluatePacket, 'function');
  const results = (policy.evaluatePacket as (input: ReturnType<typeof packet>) => Array<{ code: string; outcome: string }>)(
    packet('DE72 5001 0517 5407'),
  );
  assert.deepEqual(
    results.find((result) => result.code === 'bank_account_continuity'),
    {
      code: 'bank_account_continuity',
      outcome: 'BLOCK',
      message: 'Current invoice bank account differs from verified historical bank details.',
      evidence: results.find((result) => result.code === 'bank_account_continuity')?.evidence,
    },
  );
  assert.equal(
    results.find((result) => result.code === 'invoice_amount_matches_po')?.outcome,
    'PASS',
  );
});

test('passes bank-account continuity when verified sources agree', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.evaluatePacket, 'function');
  const results = (policy.evaluatePacket as (input: ReturnType<typeof packet>) => Array<{ code: string; outcome: string }>)(
    packet('DE89 3704 0044 0532'),
  );
  assert.equal(results.find((result) => result.code === 'bank_account_continuity')?.outcome, 'PASS');
});

test('routes a critical field below 0.90 confidence to review', async () => {
  const policy = await loadPolicy();
  assert.equal(typeof policy.evaluatePacket, 'function');
  const results = (policy.evaluatePacket as (input: ReturnType<typeof packet>) => Array<{ code: string; outcome: string }>)(
    packet('DE89 3704 0044 0532', 0.82),
  );
  assert.equal(
    results.find((result) => result.code === 'critical_confidence_threshold')?.outcome,
    'REVIEW',
  );
});

test('hard-blocks when the current invoice IBAN does not match the submitted bank-change request', async () => {
  const policy = await loadPolicy();
  const input = packet('DE72 5001 0517 5407');
  input.documents.push(doc('bank_change_letter', 'bank-change-letter.pdf', {
    vendor_id: 'V-1042',
    iban: 'DE11 1111 1111 1111',
  }));
  const results = (policy.evaluatePacket as (input: typeof input) => Array<{ code: string; outcome: string }>)(input);
  assert.equal(results.find((result) => result.code === 'bank_change_request_match')?.outcome, 'BLOCK');
});

test('requires both verified historical IBAN sources before continuity can pass', async () => {
  const policy = await loadPolicy();
  const input = packet('DE89 3704 0044 0532');
  input.documents = input.documents.filter((document) => document.kind !== 'previous_invoice');
  const results = (policy.evaluatePacket as (input: typeof input) => Array<{ code: string; outcome: string }>)(input);
  assert.equal(results.find((result) => result.code === 'bank_account_continuity')?.outcome, 'REVIEW');
});

test('hard-blocks when the bank-change request names a different vendor', async () => {
  const policy = await loadPolicy();
  const input = packet('DE72 5001 0517 5407');
  input.documents.push(doc('bank_change_letter', 'bank-change-letter.pdf', {
    vendor_id: 'V-9999',
    iban: 'DE72 5001 0517 5407',
  }));
  const results = (policy.evaluatePacket as (input: typeof input) => Array<{ code: string; outcome: string }>)(input);
  assert.equal(results.find((result) => result.code === 'bank_change_vendor_match')?.outcome, 'BLOCK');
});

test('routes malformed critical values to review instead of crashing policy evaluation', async () => {
  const policy = await loadPolicy();
  const input = packet('DE89 3704 0044 0532');
  const current = input.documents.find((document) => document.kind === 'current_invoice')!;
  const amount = current.facts.find((item) => item.field === 'amount')!;
  amount.value = 'not-a-money-value';
  assert.doesNotThrow(() => policy.evaluatePacket(input));
  const results = policy.evaluatePacket(input) as Array<{ code: string; outcome: string }>;
  assert.equal(results.find((result) => result.code === 'invoice_amount_matches_po')?.outcome, 'REVIEW');
});
