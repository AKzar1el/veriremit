import type { VerificationCase } from '@veriremit/domain';
import { appendEvent } from '@veriremit/audit';

export async function loadService() {
  return import('../src/services/case-service.ts').catch(() => ({} as Record<string, unknown>));
}

export function changedBankCase(status: VerificationCase['status'] = 'review_required'): VerificationCase {
  return {
    id: 'case_acme_po_4821',
    status,
    documents: [],
    rules: [
      ...([
        'vendor_id_match',
        'vat_id_match',
        'po_number_match',
        'currency_match',
        'invoice_amount_matches_po',
        'beneficiary_name_match',
        'bank_change_vendor_match',
        'bank_change_request_match',
        'critical_confidence_threshold',
      ] as const).map((code) => ({ code, outcome: 'PASS' as const, message: 'ok', evidence: [] })),
      {
        code: 'bank_account_continuity',
        outcome: 'BLOCK',
        message: 'changed',
        evidence: [],
      },
    ],
    humanVerification: null,
    releaseDocument: null,
    signature: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
}

export function memoryCaseRepository(initial: VerificationCase) {
  let value = structuredClone(initial);
  return {
    async create(next: VerificationCase) { value = structuredClone(next); },
    async get(id: string) { return id === value.id ? structuredClone(value) : null; },
    async save(next: VerificationCase) { value = structuredClone(next); },
  };
}

export function emptyAuditRepository() {
  let ledger: unknown[] = [];
  return {
    async get() { return structuredClone(ledger); },
    async save(_caseId: string, next: unknown[]) { ledger = structuredClone(next); },
  };
}

export function auditRepositoryWithEvents(
  caseId: string,
  events: Array<{ type: Parameters<typeof appendEvent>[1]['type']; data: Record<string, unknown> }>,
) {
  let ledger = events.reduce<ReturnType<typeof appendEvent>[]>((current, event, index) => [
    ...current,
    appendEvent(current, {
      caseId,
      type: event.type,
      occurredAt: `2026-08-29T00:${String(index).padStart(2, '0')}:00.000Z`,
      data: event.data,
    }),
  ], []);
  return {
    async get() { return structuredClone(ledger); },
    async save(_caseId: string, next: ReturnType<typeof appendEvent>[]) { ledger = structuredClone(next); },
  };
}
