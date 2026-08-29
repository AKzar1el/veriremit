import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface FieldRow {
  label: string;
  value: string;
  emphasis?: 'safe' | 'risk';
}

interface FixtureDocument {
  filename: string;
  kicker: string;
  title: string;
  subtitle: string;
  rows: readonly FieldRow[];
  note: string;
}

const outDir = resolve('fixtures/acme-components');

const docs: readonly FixtureDocument[] = [
  {
    filename: 'vendor-master.pdf',
    kicker: 'VERIFIED VENDOR MASTER',
    title: 'ACME Components GmbH',
    subtitle: 'Approved supplier record - maintained before the current payment request',
    rows: [
      { label: 'Vendor ID', value: 'V-1042' },
      { label: 'VAT ID', value: 'DE123456789' },
      { label: 'Beneficiary', value: 'ACME Components GmbH' },
      { label: 'Verified IBAN', value: 'DE89 3704 0044 0532', emphasis: 'safe' },
      { label: 'Trusted phone', value: '+49 30 555 0104', emphasis: 'safe' },
    ],
    note: 'Independent verification must use this pre-existing phone number, never contact details from a bank-change request.',
  },
  {
    filename: 'purchase-order-4821.pdf',
    kicker: 'PURCHASE ORDER',
    title: 'PO-4821',
    subtitle: 'Issued by Demo Manufacturing Europe GmbH to ACME Components GmbH',
    rows: [
      { label: 'Supplier', value: 'ACME Components GmbH' },
      { label: 'Vendor ID', value: 'V-1042' },
      { label: 'Order total', value: '48,620.00 EUR' },
      { label: 'Delivery', value: 'September 2026 production components' },
      { label: 'Payment terms', value: 'Net 30 - release after three-way verification' },
    ],
    note: 'This purchase order contains no instruction to change supplier banking details.',
  },
  {
    filename: 'previous-invoice.pdf',
    kicker: 'HISTORICAL PAID INVOICE',
    title: 'ACME Components GmbH',
    subtitle: 'Prior verified invoice retained as payment-history evidence',
    rows: [
      { label: 'Vendor ID', value: 'V-1042' },
      { label: 'VAT ID', value: 'DE123456789' },
      { label: 'Beneficiary', value: 'ACME Components GmbH' },
      { label: 'Historical IBAN', value: 'DE89 3704 0044 0532', emphasis: 'safe' },
      { label: 'Historical status', value: 'Paid - verified account on file' },
    ],
    note: 'The historical account matches the verified vendor master.',
  },
  {
    filename: 'invoice-8842.pdf',
    kicker: 'CURRENT INVOICE - PAYMENT REQUEST',
    title: 'Invoice 8842',
    subtitle: 'ACME Components GmbH - references PO-4821',
    rows: [
      { label: 'Vendor ID', value: 'V-1042' },
      { label: 'VAT ID', value: 'DE123456789' },
      { label: 'PO number', value: 'PO-4821' },
      { label: 'Invoice total', value: '48,620.00 EUR' },
      { label: 'Beneficiary', value: 'ACME Components GmbH' },
      { label: 'Payment IBAN', value: 'DE72 5001 0517 5407', emphasis: 'risk' },
    ],
    note: 'ATTENTION: the payment IBAN differs from the verified vendor master and historical invoice.',
  },
  {
    filename: 'bank-change-letter.pdf',
    kicker: 'BANK DETAIL CHANGE NOTICE',
    title: 'ACME Components GmbH',
    subtitle: 'Purported supplier request received with the current invoice',
    rows: [
      { label: 'Vendor ID', value: 'V-1042' },
      { label: 'Requested IBAN', value: 'DE72 5001 0517 5407', emphasis: 'risk' },
      { label: 'Effective date', value: 'Immediately' },
      { label: 'Contact on notice', value: '+49 30 555 9917' },
    ],
    note: 'UNTRUSTED CHANNEL: contact details on this notice must not be used to verify the requested bank-account change.',
  },
];

function pdfEscape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function text(x: number, y: number, value: string, size = 11, bold = false, rgb = '0.10 0.13 0.20'): string {
  return `${rgb} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
}

function rect(x: number, y: number, width: number, height: number, rgb: string, stroke?: string): string {
  const fill = `${rgb} rg ${x} ${y} ${width} ${height} re f`;
  if (!stroke) return fill;
  return `${fill}\n${stroke} RG 1 w ${x} ${y} ${width} ${height} re S`;
}

function buildContent(doc: FixtureDocument): string {
  const commands: string[] = [];
  commands.push(rect(0, 0, 595, 842, '0.97 0.98 0.99'));
  commands.push(rect(0, 766, 595, 76, '0.06 0.09 0.16'));
  commands.push(text(42, 808, 'VERIREMIT', 10, true, '1 1 1'));
  commands.push(text(42, 785, doc.kicker, 17, true, '1 1 1'));
  commands.push(rect(390, 790, 163, 25, '1.00 0.95 0.75'));
  commands.push(text(405, 798, 'DEMO - FICTIONAL DATA', 9, true, '0.35 0.24 0.02'));

  commands.push(text(42, 715, doc.title, 25, true));
  commands.push(text(42, 691, doc.subtitle, 10, false, '0.38 0.42 0.50'));
  commands.push(rect(42, 661, 511, 1, '0.84 0.86 0.90'));

  let y = 614;
  for (const row of doc.rows) {
    const bg = row.emphasis === 'risk' ? '1.00 0.94 0.93' : row.emphasis === 'safe' ? '0.93 0.98 0.95' : '1 1 1';
    const stroke = row.emphasis === 'risk' ? '0.85 0.25 0.20' : row.emphasis === 'safe' ? '0.16 0.55 0.35' : '0.87 0.89 0.92';
    commands.push(rect(42, y, 511, 48, bg, stroke));
    commands.push(text(57, y + 27, row.label.toUpperCase(), 8, true, '0.40 0.44 0.51'));
    commands.push(text(203, y + 24, row.value, row.emphasis ? 13 : 11, row.emphasis !== undefined));
    y -= 58;
  }

  commands.push(rect(42, 112, 511, 78, '0.96 0.97 0.98', '0.82 0.85 0.89'));
  commands.push(text(57, 164, 'CONTROL NOTE', 8, true, '0.40 0.44 0.51'));
  const words = doc.note.split(' ');
  let line = '';
  let noteY = 143;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > 76) {
      commands.push(text(57, noteY, line, 9, false, '0.24 0.28 0.35'));
      line = word;
      noteY -= 14;
    } else {
      line = candidate;
    }
  }
  if (line) commands.push(text(57, noteY, line, 9, false, '0.24 0.28 0.35'));

  commands.push(text(42, 54, 'Synthetic hackathon fixture. No person, account, payment instruction, or business record in this document is real.', 7.5, false, '0.45 0.49 0.56'));
  commands.push(text(42, 39, 'Generated deterministically by scripts/generate-fixtures.ts.', 7.5, false, '0.45 0.49 0.56'));
  return commands.join('\n');
}

function buildPdf(content: string): Buffer {
  const streamLength = Buffer.byteLength(content, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${streamLength} >>\nstream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n% VeriRemit deterministic synthetic fixture\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

await mkdir(outDir, { recursive: true });
for (const doc of docs) {
  const path = resolve(outDir, doc.filename);
  await writeFile(path, buildPdf(buildContent(doc)), { mode: 0o644 });
  console.log(`generated ${doc.filename}`);
}
