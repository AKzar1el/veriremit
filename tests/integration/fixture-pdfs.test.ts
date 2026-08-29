import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const fixtureDir = resolve('fixtures/acme-components');

function extract(filename: string): string {
  const path = resolve(fixtureDir, filename);
  assert.equal(existsSync(path), true, `${filename} must exist`);
  assert.equal(readFileSync(path).subarray(0, 5).toString('ascii'), '%PDF-', `${filename} must be a PDF`);
  return execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
}

test('synthetic PDF packet encodes the exact old/new bank evidence and visibly marks demo data', () => {
  const vendor = extract('vendor-master.pdf');
  const previous = extract('previous-invoice.pdf');
  const invoice = extract('invoice-8842.pdf');
  const change = extract('bank-change-letter.pdf');
  const po = extract('purchase-order-4821.pdf');

  for (const text of [vendor, previous, invoice, change, po]) {
    assert.match(text, /DEMO - FICTIONAL DATA/);
    assert.match(text, /ACME Components GmbH/);
  }

  assert.match(vendor, /DE89 3704 0044 0532/);
  assert.match(vendor, /\+49 30 555 0104/);
  assert.match(previous, /DE89 3704 0044 0532/);
  assert.match(invoice, /DE72 5001 0517 5407/);
  assert.match(change, /DE72 5001 0517 5407/);
  assert.match(po, /PO-4821/);
  assert.match(po, /48,620\.00 EUR/);
  assert.match(invoice, /48,620\.00 EUR/);
});
