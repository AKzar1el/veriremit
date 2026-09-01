import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.ts';

export type AuditEventType =
  | 'CASE_CREATED'
  | 'DOCUMENT_REGISTERED'
  | 'EXTRACTION_STARTED'
  | 'EXTRACTION_COMPLETED'
  | 'EXTRACTION_FAILED'
  | 'RULE_EVALUATED'
  | 'EXCEPTION_RAISED'
  | 'HUMAN_VERIFICATION_RECORDED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'DOCTAVIAN_DOCUMENT_GENERATED'
  | 'FOXIT_MCP_OPERATION_COMPLETED'
  | 'RELEASE_PREPARED'
  | 'ESIGN_ENVELOPE_CREATED'
  | 'SIGNATURE_COMPLETED';

export interface AuditEventInput {
  type: AuditEventType;
  occurredAt: string;
  caseId: string;
  data: Readonly<Record<string, unknown>>;
}

export interface AuditEvent extends AuditEventInput {
  previousHash: string;
  hash: string;
}

const GENESIS_HASH = '0'.repeat(64);

function hashEvent(input: AuditEventInput, previousHash: string): string {
  return createHash('sha256')
    .update(previousHash)
    .update(canonicalJson({
      caseId: input.caseId,
      data: input.data,
      occurredAt: input.occurredAt,
      type: input.type,
    }))
    .digest('hex');
}

export function appendEvent(
  ledger: readonly AuditEvent[],
  input: AuditEventInput,
): AuditEvent {
  const previousHash = ledger.at(-1)?.hash ?? GENESIS_HASH;
  return {
    ...input,
    previousHash,
    hash: hashEvent(input, previousHash),
  };
}

export function verifyLedger(
  ledger: readonly AuditEvent[],
): { valid: true } | { valid: false; corruptIndex: number } {
  let expectedPreviousHash = GENESIS_HASH;

  for (let index = 0; index < ledger.length; index += 1) {
    const event = ledger[index];
    if (!event) continue;

    if (event.previousHash !== expectedPreviousHash) {
      return { valid: false, corruptIndex: index };
    }

    const expectedHash = hashEvent(event, expectedPreviousHash);
    if (event.hash !== expectedHash) {
      return { valid: false, corruptIndex: index };
    }

    expectedPreviousHash = event.hash;
  }

  return { valid: true };
}
