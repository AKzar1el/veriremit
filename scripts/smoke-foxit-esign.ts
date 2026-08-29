import { readFile } from 'node:fs/promises';
import { FoxitEsignClient } from '../packages/integrations/foxit-esign/src/index.ts';

const REQUIRED_ENV = [
  'FOXIT_CLIENT_ID',
  'FOXIT_CLIENT_SECRET',
  'VERIREMIT_SIGNER_EMAIL',
  'FOXIT_ESIGN_SMOKE_PDF',
] as const;

function requireSmokeEnvironment(): Record<(typeof REQUIRED_ENV)[number], string> {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required smoke-test environment variables: ${missing.join(', ')}.`);
  }
  return Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, process.env[name]!.trim()]),
  ) as Record<(typeof REQUIRED_ENV)[number], string>;
}

async function main(): Promise<void> {
  const env = requireSmokeEnvironment();
  const pdf = await readFile(env.FOXIT_ESIGN_SMOKE_PDF);
  if (pdf.length < 4 || pdf.subarray(0, 4).toString('ascii') !== '%PDF') {
    throw new Error('FOXIT_ESIGN_SMOKE_PDF must point to a PDF file.');
  }

  const appBaseUrl = (process.env.VERIREMIT_PUBLIC_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  const client = new FoxitEsignClient({
    clientId: env.FOXIT_CLIENT_ID,
    clientSecret: env.FOXIT_CLIENT_SECRET,
    baseUrl: process.env.FOXIT_ESIGN_HOST,
  });

  const envelope = await client.createEnvelope({
    folderName: `VeriRemit developer smoke ${new Date().toISOString()}`,
    filename: 'veriremit-esign-smoke.pdf',
    bytes: pdf,
    signer: {
      firstName: 'Demo',
      lastName: 'Controller',
      email: env.VERIREMIT_SIGNER_EMAIL,
    },
    signSuccessUrl: `${appBaseUrl}/signing/success`,
    signDeclineUrl: `${appBaseUrl}/signing/declined`,
  });

  if (!envelope.signingUrl) {
    throw new Error('Foxit created the envelope but did not return an embedded signing URL.');
  }

  const authoritative = await client.getStatus(envelope.envelopeId);
  console.log('Foxit eSign developer envelope created successfully.');
  console.log(`Authoritative status: ${authoritative.status}.`);
  console.log('Embedded signing URL received and intentionally not printed.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Foxit eSign smoke test failed.';
  console.error(message);
  process.exitCode = 2;
});
