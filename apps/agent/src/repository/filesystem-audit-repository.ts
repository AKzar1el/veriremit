import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditEvent } from '@veriremit/audit';
import { serializeFilesystemSave } from './filesystem-save-queue.ts';

const SAFE_CASE_ID = /^[a-zA-Z0-9_-]+$/;

export class FilesystemAuditRepository {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private pathFor(caseId: string): string {
    if (!SAFE_CASE_ID.test(caseId)) {
      throw new Error(`Invalid case id: ${caseId}`);
    }
    return join(this.root, `${caseId}.audit.json`);
  }

  async get(caseId: string): Promise<AuditEvent[]> {
    try {
      const raw = await readFile(this.pathFor(caseId), 'utf8');
      return JSON.parse(raw) as AuditEvent[];
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return [];
      throw error;
    }
  }

  async save(caseId: string, ledger: readonly AuditEvent[]): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = this.pathFor(caseId);
    await serializeFilesystemSave(target, async () => {
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      await rename(temporary, target);
    });
  }
}
