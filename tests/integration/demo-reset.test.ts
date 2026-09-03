import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

async function loadReset() {
  return import('../../scripts/demo-reset.ts').catch(() => ({} as Record<string, unknown>));
}

test('demo reset removes only repo-local .data state and refuses wider paths', async () => {
  const module = await loadReset();
  assert.equal(typeof module.resetDemoData, 'function');
  const root = await mkdtemp(join(tmpdir(), 'veriremit-reset-'));
  const nested = join(root, '.data', 'cases');
  await mkdir(nested, { recursive: true });
  await writeFile(join(nested, 'case.json'), '{}');

  try {
    await (module.resetDemoData as (repoRoot: string, dataDir: string) => Promise<string>)(root, '.data');
    assert.equal(existsSync(join(root, '.data')), false);

    await assert.rejects(
      () => (module.resetDemoData as (repoRoot: string, dataDir: string) => Promise<string>)(root, '.'),
      /only paths inside \.data/i,
    );
    await assert.rejects(
      () => (module.resetDemoData as (repoRoot: string, dataDir: string) => Promise<string>)(root, 'fixtures'),
      /only paths inside \.data/i,
    );
    await assert.rejects(
      () => (module.resetDemoData as (repoRoot: string, dataDir: string) => Promise<string>)(root, '../outside'),
      /only paths inside \.data/i,
    );
  } finally {
    await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }));
  }
});

test('demo reset allows a dedicated .data child used by browser recordings', async () => {
  const module = await loadReset();
  assert.equal(typeof module.resolveSafeDemoDataDir, 'function');
  const root = resolve('workspace', 'veriremit');
  const resolved = (module.resolveSafeDemoDataDir as (repoRoot: string, dataDir: string) => string)(
    root,
    '.data/recording',
  );
  assert.equal(resolved, join(root, '.data', 'recording'));
});
