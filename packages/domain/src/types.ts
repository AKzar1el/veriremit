import { DomainError } from './errors.ts';

export type DocumentKind =
  | 'vendor_master'
  | 'purchase_order'
  | 'previous_invoice'
  | 'current_invoice'
  | 'bank_change_letter';

export interface SourceRef {
  documentId: string;
  filename: string;
  page?: number;
  boundingBox?: readonly number[];
  text?: string;
}

export interface ExtractedFact<T> {
  field: string;
  value: T;
  normalizedValue: string;
  confidence?: number;
  source: SourceRef;
}

export interface ExtractedDocument {
  id: string;
  kind: DocumentKind;
  filename: string;
  providerDocumentId?: string;
  facts: readonly ExtractedFact<string | number>[];
  mode: 'live' | 'fixture';
}

export type CaseStatus =
  | 'created'
  | 'extracting'
  | 'review_required'
  | 'human_approved'
  | 'release_prepared'
  | 'signature_pending'
  | 'release_authorized'
  | 'rejected';

const CASE_STATUSES = new Set<CaseStatus>([
  'created',
  'extracting',
  'review_required',
  'human_approved',
  'release_prepared',
  'signature_pending',
  'release_authorized',
  'rejected',
]);

export function assertCaseStatus(value: string): asserts value is CaseStatus {
  if (!CASE_STATUSES.has(value as CaseStatus)) {
    throw new DomainError('INVALID_CASE_STATUS', `Invalid case status: ${value}`);
  }
}

export type RuleOutcome = 'PASS' | 'REVIEW' | 'BLOCK';

export interface RuleEvidence {
  label: string;
  value: string;
  source?: SourceRef;
}

export interface RuleResult {
  code:
    | 'vendor_id_match'
    | 'vat_id_match'
    | 'po_number_match'
    | 'currency_match'
    | 'invoice_amount_matches_po'
    | 'beneficiary_name_match'
    | 'bank_change_vendor_match'
    | 'bank_change_request_match'
    | 'bank_account_continuity'
    | 'critical_confidence_threshold';
  outcome: RuleOutcome;
  message: string;
  evidence: readonly RuleEvidence[];
}

export interface HumanVerification {
  method: 'trusted_callback';
  trustedContactSource: SourceRef;
  reference: string;
  reviewerName: string;
  result: 'confirmed' | 'rejected';
  recordedAt: string;
}

export interface ReleaseDocumentRef {
  id: string;
  filename: string;
  provider: 'foxit';
}

export interface SignatureRef {
  envelopeId: string;
  status: 'created' | 'pending' | 'completed' | 'declined' | 'voided';
  signingUrl?: string;
}

export interface VerificationCase {
  id: string;
  status: CaseStatus;
  documents: readonly ExtractedDocument[];
  rules: readonly RuleResult[];
  humanVerification: HumanVerification | null;
  releaseDocument: ReleaseDocumentRef | null;
  signature: SignatureRef | null;
  createdAt: string;
  updatedAt: string;
}
