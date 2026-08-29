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

test('clean clone has a committed lockfile and deterministic install paths', async () => {
  await assert.doesNotReject(access('package-lock.json'), 'package-lock.json must be committed');
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  const dockerfile = await readFile('Dockerfile.agent', 'utf8');
  assert.match(ci, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.doesNotMatch(ci, /npm install --ignore-scripts/);
  assert.match(dockerfile, /COPY package-lock\.json \.\//);
  assert.match(dockerfile, /npm ci --omit=dev --ignore-scripts --no-audit --no-fund/);
  assert.doesNotMatch(dockerfile, /npm install --omit=dev/);
});

test('live smoke scripts load gitignored .env.local and document every required local-only input', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  for (const scriptName of ['smoke:nutrient', 'smoke:foxit:mcp', 'smoke:foxit:esign']) {
    assert.match(
      packageJson.scripts?.[scriptName] ?? '',
      /node --env-file-if-exists=\.env\.local --experimental-strip-types/,
      `${scriptName} must load .env.local without requiring shell-specific export commands`,
    );
  }

  const envExample = await readFile('.env.example', 'utf8');
  assert.match(envExample, /^FOXIT_ESIGN_SMOKE_PDF=$/m);

  const gitignore = await readFile('.gitignore', 'utf8');
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
