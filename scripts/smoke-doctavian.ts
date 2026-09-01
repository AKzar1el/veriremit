import { DoctavianGenerationClient } from '../apps/agent/src/providers/doctavian-client.ts';
import { createDoctavianReleaseTemplate } from '../apps/agent/src/providers/doctavian-template.ts';

function required(name: 'DOCTAVIAN_API_KEY' | 'DOCTAVIAN_ACCESS_TOKEN'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const client = new DoctavianGenerationClient({
    apiKey: required('DOCTAVIAN_API_KEY'),
    accessToken: required('DOCTAVIAN_ACCESS_TOKEN'),
    ...(process.env.DOCTAVIAN_API_BASE_URL?.trim()
      ? { baseUrl: process.env.DOCTAVIAN_API_BASE_URL.trim() }
      : {}),
  });

  const generated = await client.generate({
    templateFilename: 'veriremit-release-template.docx',
    templateBytes: createDoctavianReleaseTemplate(),
    dataFilename: 'veriremit-release-data.json',
    data: {
      Release: {
        CaseId: 'case_acme_po_4821',
        Supplier: 'ACME Components GmbH',
        VendorId: 'V-1042',
        PoNumber: 'PO-4821',
        Amount: '48620.00',
        Currency: 'EUR',
        Beneficiary: 'ACME Components GmbH',
        Iban: 'DE72 5001 0517 5407',
        ReviewerName: 'Tomi Seregi',
        VerificationReference: 'VR-LIVE-4821',
        VerifiedAt: new Date().toISOString(),
        Checks: [
          { Code: 'bank_account_continuity', Outcome: 'PASS', Summary: 'Independent trusted callback confirmed the requested account.' },
          { Code: 'human_verification', Outcome: 'PASS', Summary: 'Human verification is recorded before document generation.' },
        ],
      },
    },
    outputFilename: 'doctavian-payment-release-authorization.pdf',
    externalContextId: `veriremit-smoke-${Date.now()}`,
  });

  const prefix = new TextDecoder().decode(generated.bytes.subarray(0, 5));
  if (prefix !== '%PDF-') {
    throw new Error('Doctavian live generation did not return a PDF document.');
  }
  console.log('Doctavian live structured document generation succeeded.');
  console.log('Generated document identifier and credentials intentionally not printed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Doctavian live smoke test failed.');
  process.exitCode = 2;
});
