import type { VerificationCase } from '@veriremit/domain';

export const DEMO_CASE_ID = 'case_acme_po_4821';

export function createDemoCase(now = new Date().toISOString()): VerificationCase {
  return {
    id: DEMO_CASE_ID,
    status: 'created',
    documents: [],
    rules: [],
    humanVerification: null,
    releaseDocument: null,
    signature: null,
    createdAt: now,
    updatedAt: now,
  };
}
