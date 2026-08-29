import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredPublicFiles = [
  'LICENSE',
  'README.md',
  'SECURITY.md',
  '.env.example',
  'docs/submission/devpost.md',
  'docs/submission/video-script.md',
  'fixtures/acme-components/vendor-master.pdf',
];

test('public repository package contains the minimum judging and reuse artifacts', async () => {
  for (const path of requiredPublicFiles) {
    await assert.doesNotReject(access(path), `missing public repository artifact: ${path}`);
  }

  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { license?: string };
  assert.equal(packageJson.license, 'MIT');

  const license = await readFile('LICENSE', 'utf8');
  assert.match(license, /^MIT License/m);
  assert.match(license, /Copyright \(c\) 2026 Tomi/);
});

test('clean clone declares the TypeScript compiler used by verification scripts', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  assert.equal(packageJson.devDependencies?.typescript, '5.8.3');
});
