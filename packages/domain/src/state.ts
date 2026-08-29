import { DomainError } from './errors.ts';
import type { CaseStatus, HumanVerification, VerificationCase } from './types.ts';

const TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  created: ['extracting', 'rejected'],
  extracting: ['review_required', 'rejected'],
  review_required: ['human_approved', 'rejected'],
  human_approved: ['release_prepared', 'rejected'],
  release_prepared: ['signature_pending', 'rejected'],
  signature_pending: ['release_authorized', 'rejected'],
  release_authorized: [],
  rejected: [],
};

export function transitionCase(
  value: VerificationCase,
  nextStatus: CaseStatus,
  updatedAt: string,
): VerificationCase {
  if (!TRANSITIONS[value.status].includes(nextStatus)) {
    throw new DomainError(
      'INVALID_CASE_TRANSITION',
      `Invalid case transition: ${value.status} -> ${nextStatus}`,
    );
  }

  return {
    ...value,
    status: nextStatus,
    updatedAt,
  };
}

export function recordHumanVerification(
  value: VerificationCase,
  verification: HumanVerification,
): VerificationCase {
  if (value.status !== 'review_required') {
    throw new DomainError(
      'INVALID_VERIFICATION_STATE',
      `Human verification can only be recorded for a review_required case, not ${value.status}`,
    );
  }

  const nextStatus: CaseStatus = verification.result === 'confirmed' ? 'human_approved' : 'rejected';
  return {
    ...transitionCase(value, nextStatus, verification.recordedAt),
    humanVerification: verification,
  };
}
