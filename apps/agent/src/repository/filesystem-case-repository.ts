import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VerificationCase } from '@veriremit/domain';
import type { CaseRepository } from './case-repository.ts';

const SAFE_CASE_ID = /^[a-zA-Z0-9_-]+$/;

export class FilesystemCaseRepository implements CaseRepository {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private pathFor(id: string): string {
    if (!SAFE_CASE_ID.test(id)) {
      throw new Error(`Invalid case id: ${id}`);
    }
    return join(this.root, `${id}.json`);
  }

  private async writeAtomic(value: VerificationCase): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = this.pathFor(value.id);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
  }

  async create(value: VerificationCase): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = this.pathFor(value.id);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      await link(temporary, target);
    } catch (error) {
      if ((error as { code?: string }).code === 'EEXIST') {
        throw new Error(`Case already exists: ${value.id}`);
      }
      throw error;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async get(id: string): Promise<VerificationCase | null> {
    try {
      const raw = await readFile(this.pathFor(id), 'utf8');
      return JSON.parse(raw) as VerificationCase;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(value: VerificationCase): Promise<void> {
    await this.writeAtomic(value);
  }
}
