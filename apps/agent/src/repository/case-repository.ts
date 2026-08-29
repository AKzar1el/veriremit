import type { VerificationCase } from '@veriremit/domain';

export interface CaseRepository {
  create(value: VerificationCase): Promise<void>;
  get(id: string): Promise<VerificationCase | null>;
  save(value: VerificationCase): Promise<void>;
}
