import { DoctavianGenerationClient } from '../apps/agent/src/providers/doctavian-client.ts';
import { createDoctavianReleaseTemplate } from '../apps/agent/src/providers/doctavian-template.ts';
import { createCanonicalDoctavianReleaseData } from './doctavian-canonical.ts';

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
    data: createCanonicalDoctavianReleaseData(new Date().toISOString()),
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
