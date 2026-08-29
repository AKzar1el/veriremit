import { readFile } from 'node:fs/promises';
import { NutrientExtractionClient, NutrientViewerGateway } from '../packages/integrations/nutrient/src/index.ts';

function required(name: 'NUTRIENT_API_KEY' | 'NUTRIENT_DWS_VIEWER_API_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const extractionKey = required('NUTRIENT_API_KEY');
  const viewerKey = required('NUTRIENT_DWS_VIEWER_API_KEY');
  const filename = 'vendor-master.pdf';
  const bytes = new Uint8Array(await readFile(`fixtures/acme-components/${filename}`));

  const extractor = new NutrientExtractionClient({ apiKey: extractionKey });
  const extracted = await extractor.extract({
    filename,
    bytes,
    kind: 'vendor_master',
  });
  const fields = extracted.facts.map((fact) => fact.field).sort();
  if (!fields.includes('iban') || !fields.includes('trusted_phone')) {
    throw new Error('Nutrient live extraction did not return required grounded fields.');
  }
  if (extracted.facts.some((fact) => fact.source.page === undefined || fact.source.boundingBox === undefined)) {
    throw new Error('Nutrient live extraction did not ground every extracted field to page coordinates.');
  }
  console.log(`Nutrient live extraction succeeded with ${fields.length} grounded fields.`);

  const viewer = new NutrientViewerGateway({ apiKey: viewerKey });
  const uploaded = await viewer.ensureDocument({ filename, bytes });
  const session = await viewer.createSession({ documentId: uploaded.documentId });
  if (!session.token || !session.expiresAt) {
    throw new Error('Nutrient DWS Viewer did not return a scoped short-lived session.');
  }
  console.log('Nutrient DWS upload and scoped read-only viewer session succeeded.');
  console.log('Viewer document id and session token intentionally not printed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nutrient live smoke test failed.');
  process.exitCode = 2;
});
