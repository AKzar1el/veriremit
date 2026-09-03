import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appendEvent } from '@veriremit/audit';

test('filesystem audit repository round-trips a hash chain with platform-appropriate file checks', async () => {
  const mod = await import('../src/repository/filesystem-audit-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  assert.equal(typeof mod.FilesystemAuditRepository, 'function');

  const root = await mkdtemp(join(tmpdir(), 'veriremit-audits-'));
  try {
    const Repository = mod.FilesystemAuditRepository as new (root: string) => {
      get(caseId: string): Promise<unknown[]>;
      save(caseId: string, ledger: readonly unknown[]): Promise<void>;
    };
    const repo = new Repository(root);
    assert.deepEqual(await repo.get('case_demo'), []);

    const first = appendEvent([], {
      caseId: 'case_demo',
      type: 'CASE_CREATED',
      occurredAt: '2026-08-29T00:00:00.000Z',
      data: {},
    });
    const ledger = [first];
    await repo.save('case_demo', ledger);
    assert.deepEqual(await repo.get('case_demo'), ledger);

    const target = join(root, 'case_demo.audit.json');
    const raw = await readFile(target, 'utf8');
    assert.equal(raw.endsWith('\n'), true);
    const file = await stat(target);
    assert.equal(file.isFile(), true);
    if (process.platform !== 'win32') {
      assert.equal(file.mode & 0o777, 0o600);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem audit repository rejects unsafe case identifiers', async () => {
  const mod = await import('../src/repository/filesystem-audit-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  assert.equal(typeof mod.FilesystemAuditRepository, 'function');
  const root = await mkdtemp(join(tmpdir(), 'veriremit-audits-'));
  try {
    const Repository = mod.FilesystemAuditRepository as new (root: string) => {
      get(caseId: string): Promise<unknown[]>;
    };
    const repo = new Repository(root);
    await assert.rejects(() => repo.get('../escape'), /invalid case id/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem audit repository tolerates concurrent atomic saves from the same process', async () => {
  const mod = await import('../src/repository/filesystem-audit-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  const Repository = mod.FilesystemAuditRepository as new (root: string) => {
    get(caseId: string): Promise<unknown[]>;
    save(caseId: string, ledger: readonly unknown[]): Promise<void>;
  };
  const root = await mkdtemp(join(tmpdir(), 'veriremit-audits-'));
  try {
    const repo = new Repository(root);
    const ledgers = Array.from({ length: 20 }, (_, index) => [{ index }]);
    const results = await Promise.allSettled(ledgers.map((ledger) => repo.save('case_demo', ledger)));
    assert.equal(results.every((result) => result.status === 'fulfilled'), true);
    const final = await repo.get('case_demo') as Array<{ index: number }>;
    assert.equal(ledgers.some((ledger) => ledger[0]?.index === final[0]?.index), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
