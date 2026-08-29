import type { ExtractedDocument, RuleResult, SourceRef, VerificationCase } from '@veriremit/domain';

export type StatusTone = 'neutral' | 'working' | 'blocked' | 'approved' | 'complete';

export interface WorkbenchActions {
  runReview: boolean;
  recordReview: boolean;
  prepareRelease: boolean;
  sendForSignature: boolean;
  refreshSignature: boolean;
}

export interface BankChangeView {
  oldIban: string;
  newIban: string;
  oldSource: SourceRef;
  newSource: SourceRef;
  message: string;
}

export interface WorkbenchView {
  caseId: string;
  status: VerificationCase['status'];
  statusTone: StatusTone;
  fixtureMode: boolean;
  controls: readonly RuleResult[];
  bankChange: BankChangeView | null;
  trustedPhone: string | null;
  signingUrl: string | null;
  actions: WorkbenchActions;
  auditRequired: boolean;
}

function fact(document: ExtractedDocument | undefined, field: string) {
  return document?.facts.find((candidate) => candidate.field === field);
}

export function maskIban(value: string): string {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  if (normalized.length <= 8) return normalized;
  const prefix = normalized.slice(0, 4);
  const suffix = normalized.slice(-4);
  const middleLength = Math.max(0, normalized.length - 8);
  const groups = Math.max(1, Math.ceil(middleLength / 4));
  return `${prefix} ${Array.from({ length: groups }, () => '••••').join(' ')} ${suffix}`;
}

function statusTone(status: VerificationCase['status']): StatusTone {
  switch (status) {
    case 'created': return 'neutral';
    case 'extracting': return 'working';
    case 'review_required':
    case 'rejected': return 'blocked';
    case 'human_approved':
    case 'release_prepared':
    case 'signature_pending': return 'approved';
    case 'release_authorized': return 'complete';
  }
}

function actionsFor(status: VerificationCase['status']): WorkbenchActions {
  return {
    runReview: status === 'created',
    recordReview: status === 'review_required',
    prepareRelease: status === 'human_approved',
    sendForSignature: status === 'release_prepared',
    refreshSignature: status === 'signature_pending',
  };
}

export function buildWorkbenchView(value: VerificationCase): WorkbenchView {
  const vendorMaster = value.documents.find((document) => document.kind === 'vendor_master');
  const currentInvoice = value.documents.find((document) => document.kind === 'current_invoice');
  const oldIban = fact(vendorMaster, 'iban');
  const newIban = fact(currentInvoice, 'iban');
  const bankRule = value.rules.find((rule) => rule.code === 'bank_account_continuity');
  const trustedPhone = fact(vendorMaster, 'trusted_phone');

  const bankChange = bankRule?.outcome === 'BLOCK' && oldIban && newIban
    ? {
        oldIban: maskIban(oldIban.normalizedValue),
        newIban: maskIban(newIban.normalizedValue),
        oldSource: oldIban.source,
        newSource: newIban.source,
        message: bankRule.message,
      }
    : null;

  return {
    caseId: value.id,
    status: value.status,
    statusTone: statusTone(value.status),
    fixtureMode: value.documents.some((document) => document.mode === 'fixture'),
    controls: value.rules,
    bankChange,
    trustedPhone: trustedPhone ? String(trustedPhone.value) : null,
    signingUrl: value.signature?.signingUrl ?? null,
    actions: actionsFor(value.status),
    auditRequired: value.status !== 'created' && value.status !== 'extracting',
  };
}
