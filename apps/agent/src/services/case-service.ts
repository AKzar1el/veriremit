import { appendEvent, verifyLedger } from '@veriremit/audit';
import type { AuditEvent } from '@veriremit/audit';
import { recordHumanVerification, transitionCase } from '@veriremit/domain';
import type {
  DocumentKind,
  ExtractedDocument,
  HumanVerification,
  SignatureRef,
  VerificationCase,
} from '@veriremit/domain';
import { evaluatePacket, evaluateReleaseGate } from '@veriremit/policy';
import type { CaseRepository } from '../repository/case-repository.ts';

interface AuditRepository {
  get(caseId: string): Promise<readonly AuditEvent[]>;
  save(caseId: string, ledger: readonly AuditEvent[]): Promise<void>;
}

interface DocumentExtractor {
  extract(input: {
    filename: string;
    bytes: Uint8Array;
    kind: DocumentKind;
  }): Promise<ExtractedDocument>;
}

export interface ExtractionDocumentInput {
  filename: string;
  bytes: Uint8Array;
  kind: DocumentKind;
}

interface ReleasePacketInput {
  releaseHtml: string;
  releaseData?: Readonly<Record<string, unknown>>;
  evidenceDocuments: Array<{ filename: string; bytes: Uint8Array }>;
  outputPath: string;
  outputFilename?: string;
}

interface GeneratedReleaseDocument {
  id: string;
  filename: string;
  provider: 'foxit';
  localPath: string;
  generation?: {
    id: string;
    filename: string;
    provider: 'doctavian';
  };
}

interface ReleasePacketGateway {
  prepare(input: ReleasePacketInput): Promise<GeneratedReleaseDocument>;
}

interface ReleaseEnvelopeInput {
  folderName: string;
  filename: string;
  bytes: Uint8Array;
  signer: { firstName: string; lastName: string; email: string };
  signSuccessUrl: string;
  signDeclineUrl: string;
}

interface SignatureEnvelope {
  envelopeId: string;
  status: SignatureRef['status'];
  signingUrl?: string;
}

interface SignatureGateway {
  createEnvelope(input: ReleaseEnvelopeInput): Promise<SignatureEnvelope>;
  getStatus(envelopeId: string): Promise<{ envelopeId: string; status: SignatureRef['status'] }>;
}

export class CaseServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: readonly string[];

  constructor(code: string, message: string, statusCode: number, details?: readonly string[]) {
    super(message);
    this.name = 'CaseServiceError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function sanitizeHumanVerification(value: unknown, recordedAt: string): HumanVerification {
  if (!isRecord(value) || value.method !== 'trusted_callback'
    || (value.result !== 'confirmed' && value.result !== 'rejected')) {
    throw new CaseServiceError(
      'INVALID_HUMAN_VERIFICATION',
      'Human verification payload is invalid.',
      400,
    );
  }
  const reference = boundedText(value.reference, 128);
  const reviewerName = boundedText(value.reviewerName, 120);
  const source = isRecord(value.trustedContactSource) ? value.trustedContactSource : undefined;
  const documentId = boundedText(source?.documentId, 160);
  const filename = boundedText(source?.filename, 255);
  const page = source?.page;
  if (!reference || !reviewerName || !documentId || !filename
    || (page !== undefined && (!Number.isInteger(page) || (page as number) < 1))) {
    throw new CaseServiceError(
      'INVALID_HUMAN_VERIFICATION',
      'Human verification payload is invalid.',
      400,
    );
  }
  return {
    method: 'trusted_callback',
    trustedContactSource: {
      documentId,
      filename,
      ...(page !== undefined ? { page: page as number } : {}),
    },
    reference,
    reviewerName,
    result: value.result,
    recordedAt,
  };
}

interface CaseServiceDependencies {
  cases: CaseRepository;
  audits: AuditRepository;
  extractor?: DocumentExtractor;
  releaseGateway: ReleasePacketGateway;
  signatureGateway: SignatureGateway;
  now?: () => string;
}

export class CaseService {
  readonly cases: CaseRepository;
  readonly audits: AuditRepository;
  readonly extractor: DocumentExtractor | undefined;
  readonly releaseGateway: ReleasePacketGateway;
  readonly signatureGateway: SignatureGateway;
  readonly now: () => string;
  private readonly caseLocks = new Map<string, Promise<void>>();

  constructor(dependencies: CaseServiceDependencies) {
    this.cases = dependencies.cases;
    this.audits = dependencies.audits;
    this.extractor = dependencies.extractor;
    this.releaseGateway = dependencies.releaseGateway;
    this.signatureGateway = dependencies.signatureGateway;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  private async withCaseLock<T>(caseId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.caseLocks.get(caseId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.caseLocks.set(caseId, queued);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.caseLocks.get(caseId) === queued) this.caseLocks.delete(caseId);
    }
  }

  private async requireCase(caseId: string): Promise<VerificationCase> {
    const value = await this.cases.get(caseId);
    if (!value) {
      throw new CaseServiceError('CASE_NOT_FOUND', 'Verification case was not found.', 404);
    }
    return value;
  }

  private async requireValidAudit(caseId: string): Promise<readonly AuditEvent[]> {
    const ledger = await this.audits.get(caseId);
    const verification = verifyLedger(ledger);
    if (!verification.valid) {
      throw new CaseServiceError(
        'AUDIT_INVALID',
        'Audit integrity verification failed; consequential actions are disabled.',
        409,
        [`corrupt_index:${verification.corruptIndex}`],
      );
    }
    return ledger;
  }

  private requireAuditEvidence(
    ledger: readonly AuditEvent[],
    type: AuditEvent['type'],
    matches: (event: AuditEvent) => boolean,
  ): void {
    if (ledger.some((event) => event.type === type && matches(event))) return;
    throw new CaseServiceError(
      'AUDIT_STATE_MISMATCH',
      'Case state is not backed by the required audit evidence; consequential actions are disabled.',
      409,
      [`missing_audit_event:${type}`],
    );
  }

  private async appendAudit(
    caseId: string,
    ledger: readonly AuditEvent[],
    type: AuditEvent['type'],
    data: Readonly<Record<string, unknown>>,
  ): Promise<readonly AuditEvent[]> {
    const next = [...ledger, appendEvent(ledger, {
      caseId,
      type,
      occurredAt: this.now(),
      data,
    })];
    await this.audits.save(caseId, next);
    return next;
  }

  async extract(
    caseId: string,
    inputs: readonly ExtractionDocumentInput[],
  ): Promise<VerificationCase> {
    return this.withCaseLock(caseId, async () => {
      const extractor = this.extractor;
      if (!extractor) {
        throw new CaseServiceError(
          'EXTRACTION_UNAVAILABLE',
          'Document extraction is not configured.',
          503,
        );
      }

      const value = await this.requireCase(caseId);
      let ledger = await this.requireValidAudit(caseId);
      if (value.status !== 'created') {
        throw new CaseServiceError(
          'EXTRACTION_BLOCKED',
          'Extraction can only start for a newly created verification case.',
          409,
          [`case_status:${value.status}`],
        );
      }

      const extracting = transitionCase(value, 'extracting', this.now());
      ledger = await this.appendAudit(caseId, ledger, 'EXTRACTION_STARTED', {
        documentCount: inputs.length,
      });

      try {
        const documents: ExtractedDocument[] = [];
        for (const input of inputs) {
          ledger = await this.appendAudit(caseId, ledger, 'DOCUMENT_REGISTERED', {
            filename: input.filename,
            kind: input.kind,
          });
          const document = await extractor.extract(input);
          documents.push(document);
          ledger = await this.appendAudit(caseId, ledger, 'EXTRACTION_COMPLETED', {
            filename: document.filename,
            kind: document.kind,
            mode: document.mode,
            factCount: document.facts.length,
          });
        }

        const rules = evaluatePacket({ documents });
        const reviewed = transitionCase(extracting, 'review_required', this.now());
        const next: VerificationCase = {
          ...reviewed,
          documents,
          rules,
        };

        for (const rule of rules) {
          ledger = await this.appendAudit(caseId, ledger, 'RULE_EVALUATED', {
            code: rule.code,
            outcome: rule.outcome,
          });
          if (rule.outcome !== 'PASS') {
            ledger = await this.appendAudit(caseId, ledger, 'EXCEPTION_RAISED', {
              code: rule.code,
              outcome: rule.outcome,
            });
          }
        }

        await this.cases.save(next);

        return next;
      } catch (error) {
        await this.appendAudit(caseId, ledger, 'EXTRACTION_FAILED', {
          reason: 'provider_or_policy_failure',
        }).catch(() => undefined);
        throw error;
      }
    });
  }

  async recordReview(
    caseId: string,
    verification: HumanVerification,
  ): Promise<VerificationCase> {
    return this.withCaseLock(caseId, async () => {
      const value = await this.requireCase(caseId);
      if (value.status !== 'review_required') {
        throw new CaseServiceError(
          'REVIEW_BLOCKED',
          'Human verification can only be recorded for a case requiring review.',
          409,
          [`case_status:${value.status}`],
        );
      }
      const sanitizedVerification = sanitizeHumanVerification(verification, this.now());
      let ledger = await this.requireValidAudit(caseId);
      const trustedPhoneSource = value.documents
        .find((document) => document.kind === 'vendor_master')
        ?.facts.find((fact) => fact.field === 'trusted_phone')
        ?.source;
      if (
        !trustedPhoneSource
        || trustedPhoneSource.documentId !== sanitizedVerification.trustedContactSource.documentId
        || trustedPhoneSource.filename !== sanitizedVerification.trustedContactSource.filename
        || (trustedPhoneSource.page !== undefined
          && sanitizedVerification.trustedContactSource.page !== trustedPhoneSource.page)
      ) {
        throw new CaseServiceError(
          'UNTRUSTED_CONTACT_SOURCE',
          'Human verification must use the trusted contact stored in the verified vendor master.',
          409,
        );
      }

      const next = recordHumanVerification(value, sanitizedVerification);
      await this.cases.save(next);

      ledger = await this.appendAudit(caseId, ledger, 'HUMAN_VERIFICATION_RECORDED', {
        method: sanitizedVerification.method,
        reference: sanitizedVerification.reference,
        result: sanitizedVerification.result,
        reviewerName: sanitizedVerification.reviewerName,
      });
      await this.appendAudit(
        caseId,
        ledger,
        sanitizedVerification.result === 'confirmed' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        { reference: sanitizedVerification.reference },
      );
      return next;
    });
  }

  async prepareRelease(caseId: string, input: ReleasePacketInput): Promise<VerificationCase> {
    return this.withCaseLock(caseId, async () => {
      const value = await this.requireCase(caseId);
      let ledger = await this.requireValidAudit(caseId);
      const gate = evaluateReleaseGate(value);
      if (!gate.allowed) {
        throw new CaseServiceError(
          'RELEASE_BLOCKED',
          'Payment release is blocked until all deterministic controls and human-verification requirements pass.',
          409,
          gate.reasons,
        );
      }
      this.requireAuditEvidence(ledger, 'APPROVAL_GRANTED', (event) =>
        event.data.reference === value.humanVerification?.reference
      );

      const generated = await this.releaseGateway.prepare(input);
      const transitioned = transitionCase(value, 'release_prepared', this.now());
      const next: VerificationCase = {
        ...transitioned,
        releaseDocument: {
          id: generated.id,
          filename: generated.filename,
          provider: 'foxit',
        },
      };
      await this.cases.save(next);

      if (generated.generation?.provider === 'doctavian') {
        ledger = await this.appendAudit(caseId, ledger, 'DOCTAVIAN_DOCUMENT_GENERATED', {
          documentId: generated.generation.id,
          filename: generated.generation.filename,
        });
      }
      ledger = await this.appendAudit(caseId, ledger, 'FOXIT_MCP_OPERATION_COMPLETED', {
        documentId: generated.id,
        filename: generated.filename,
      });
      await this.appendAudit(caseId, ledger, 'RELEASE_PREPARED', {
        documentId: generated.id,
        filename: generated.filename,
      });
      return next;
    });
  }

  async refreshSignature(caseId: string): Promise<VerificationCase> {
    return this.withCaseLock(caseId, async () => {
      const value = await this.requireCase(caseId);
      let ledger = await this.requireValidAudit(caseId);
      if (value.status !== 'signature_pending' || !value.signature) {
        throw new CaseServiceError(
          'SIGNATURE_STATUS_BLOCKED',
          'Signature status can only be refreshed for a pending signature.',
          409,
          [`case_status:${value.status}`],
        );
      }
      this.requireAuditEvidence(ledger, 'ESIGN_ENVELOPE_CREATED', (event) =>
        event.data.envelopeId === value.signature?.envelopeId
      );

      const refreshed = await this.signatureGateway.getStatus(value.signature.envelopeId);
      if (refreshed.envelopeId !== value.signature.envelopeId) {
        throw new CaseServiceError(
          'SIGNATURE_STATUS_INVALID',
          'Signature provider returned a mismatched envelope identifier.',
          502,
        );
      }

      if (refreshed.status === 'completed') {
        const transitioned = transitionCase(value, 'release_authorized', this.now());
        const next: VerificationCase = {
          ...transitioned,
          signature: {
            envelopeId: refreshed.envelopeId,
            status: 'completed',
          },
        };
        await this.cases.save(next);
        ledger = await this.appendAudit(caseId, ledger, 'SIGNATURE_COMPLETED', {
          envelopeId: refreshed.envelopeId,
        });
        void ledger;
        return next;
      }

      const next: VerificationCase = {
        ...value,
        signature: {
          ...value.signature,
          status: refreshed.status,
        },
        updatedAt: this.now(),
      };
      await this.cases.save(next);
      return next;
    });
  }

  async sign(caseId: string, input: ReleaseEnvelopeInput): Promise<VerificationCase> {
    return this.withCaseLock(caseId, async () => {
      const value = await this.requireCase(caseId);
      const ledger = await this.requireValidAudit(caseId);
      if (value.status !== 'release_prepared' || !value.releaseDocument) {
        throw new CaseServiceError(
          'SIGNATURE_BLOCKED',
          'Signature creation is blocked until a gated release document has been prepared.',
          409,
          [`case_status:${value.status}`],
        );
      }
      this.requireAuditEvidence(ledger, 'RELEASE_PREPARED', (event) =>
        event.data.documentId === value.releaseDocument?.id
      );

      const envelope = await this.signatureGateway.createEnvelope(input);
      const transitioned = transitionCase(value, 'signature_pending', this.now());
      const next: VerificationCase = {
        ...transitioned,
        signature: {
          envelopeId: envelope.envelopeId,
          status: envelope.status,
        },
      };
      await this.cases.save(next);
      await this.appendAudit(caseId, ledger, 'ESIGN_ENVELOPE_CREATED', {
        envelopeId: envelope.envelopeId,
        status: envelope.status,
      });
      if (!envelope.signingUrl) return next;
      return {
        ...next,
        signature: {
          ...next.signature!,
          signingUrl: envelope.signingUrl,
        },
      };
    });
  }
}
