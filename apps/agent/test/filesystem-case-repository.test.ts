import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';

const sample: VerificationCase = {
  id: 'case_demo',
  status: 'created',
  documents: [],
  rules: [],
  humanVerification: null,
  releaseDocument: null,
  signature: null,
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
};

test('filesystem repository round-trips a case and refuses duplicate create', async () => {
  const mod = await import('../src/repository/filesystem-case-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  assert.equal(typeof mod.FilesystemCaseRepository, 'function');

  const root = await mkdtemp(join(tmpdir(), 'veriremit-cases-'));
  try {
    const Repository = mod.FilesystemCaseRepository as new (root: string) => {
      create(value: VerificationCase): Promise<void>;
      get(id: string): Promise<VerificationCase | null>;
      save(value: VerificationCase): Promise<void>;
    };
    const repo = new Repository(root);
    await repo.create(sample);
    assert.deepEqual(await repo.get(sample.id), sample);
    await assert.rejects(() => repo.create(sample), /already exists/i);

    const updated = { ...sample, status: 'extracting' as const, updatedAt: '2026-08-29T00:01:00.000Z' };
    await repo.save(updated);
    assert.deepEqual(await repo.get(sample.id), updated);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem case repository rejects unsafe case identifiers on read and write paths', async () => {
  const mod = await import('../src/repository/filesystem-case-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  assert.equal(typeof mod.FilesystemCaseRepository, 'function');

  const root = await mkdtemp(join(tmpdir(), 'veriremit-cases-'));
  try {
    const Repository = mod.FilesystemCaseRepository as new (root: string) => {
      get(id: string): Promise<VerificationCase | null>;
      save(value: VerificationCase): Promise<void>;
    };
    const repo = new Repository(root);
    await assert.rejects(() => repo.get('../escape'), /invalid case id/i);
    await assert.rejects(
      () => repo.save({ ...sample, id: '../escape' }),
      /invalid case id/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem case repository tolerates concurrent atomic saves from the same process', async () => {
  const mod = await import('../src/repository/filesystem-case-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  const Repository = mod.FilesystemCaseRepository as new (root: string) => {
    create(value: VerificationCase): Promise<void>;
    get(id: string): Promise<VerificationCase | null>;
    save(value: VerificationCase): Promise<void>;
  };
  const root = await mkdtemp(join(tmpdir(), 'veriremit-cases-'));
  try {
    const repo = new Repository(root);
    await repo.create(sample);
    const variants = Array.from({ length: 20 }, (_, index) => ({
      ...sample,
      updatedAt: `2026-08-29T00:${String(index).padStart(2, '0')}:00.000Z`,
    }));
    const results = await Promise.allSettled(variants.map((value) => repo.save(value)));
    assert.equal(results.every((result) => result.status === 'fulfilled'), true);
    const final = await repo.get(sample.id);
    assert.ok(final);
    assert.equal(variants.some((value) => value.updatedAt === final.updatedAt), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem case repository allows exactly one concurrent create for the same case id', async () => {
  const mod = await import('../src/repository/filesystem-case-repository.ts').catch(
    () => ({} as Record<string, unknown>),
  );
  const Repository = mod.FilesystemCaseRepository as new (root: string) => {
    create(value: VerificationCase): Promise<void>;
    get(id: string): Promise<VerificationCase | null>;
  };
  const root = await mkdtemp(join(tmpdir(), 'veriremit-cases-'));
  try {
    const repositories = Array.from({ length: 20 }, () => new Repository(root));
    const results = await Promise.allSettled(repositories.map((repo) => repo.create(sample)));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 19);
    assert.deepEqual(await repositories[0]!.get(sample.id), sample);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
