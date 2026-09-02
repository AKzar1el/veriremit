import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDoctavianReleaseTemplate } from '../apps/agent/src/providers/doctavian-template.ts';
import {
  CANONICAL_DOCTAVIAN_VERIFIED_AT,
  createCanonicalDoctavianReleaseData,
} from './doctavian-canonical.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(repositoryRoot, 'artifacts', 'doctavian');
const templatePath = resolve(outputDirectory, 'veriremit-release-template.docx');
const dataPath = resolve(outputDirectory, 'veriremit-release-data.json');

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(templatePath, createDoctavianReleaseTemplate()),
  writeFile(
    dataPath,
    `${JSON.stringify(createCanonicalDoctavianReleaseData(CANONICAL_DOCTAVIAN_VERIFIED_AT), null, 2)}\n`,
    'utf8',
  ),
]);

console.log('Generated canonical Doctavian artifacts:');
console.log(templatePath);
console.log(dataPath);
