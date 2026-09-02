import { readFileSync } from 'node:fs';

const TEMPLATE_URL = new URL(
  '../../../../artifacts/doctavian/veriremit-release-template.docx',
  import.meta.url,
);

const templateBytes = readFileSync(TEMPLATE_URL);

/**
 * Returns the provider-native VeriRemit DOCX template that was derived from and preserves
 * Doctavian's working Maven Word template package. Do not synthesize this package with a
 * generic DOCX writer: the live Doctavian parser rejected those structurally-valid files.
 */
export function createDoctavianReleaseTemplate(): Uint8Array {
  return new Uint8Array(templateBytes);
}
