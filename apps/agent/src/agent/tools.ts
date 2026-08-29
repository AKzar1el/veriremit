import type { VerificationCase } from '@veriremit/domain';

export interface ReviewerToolDependencies {
  getCase(caseId: string): Promise<VerificationCase | null>;
  extractCase(caseId: string): Promise<VerificationCase>;
  prepareRelease(caseId: string): Promise<VerificationCase>;
  requestHumanSignature(caseId: string): Promise<VerificationCase>;
}

export interface ReviewerToolDefinition {
  name: 'get_case_summary' | 'extract_case' | 'prepare_release' | 'request_human_signature';
  description: string;
  parameters: {
    readonly type: 'object';
    readonly properties: { readonly caseId: { readonly type: 'string'; readonly minLength: number } };
    readonly required: readonly ['caseId'];
    readonly additionalProperties: false;
  };
  invoke(input: unknown): Promise<unknown>;
}

function requireCaseId(input: unknown): string {
  if (
    typeof input !== 'object'
    || input === null
    || !('caseId' in input)
    || typeof (input as { caseId?: unknown }).caseId !== 'string'
    || (input as { caseId: string }).caseId.trim().length === 0
  ) {
    throw new TypeError('caseId is required.');
  }
  return (input as { caseId: string }).caseId.trim();
}

function summarizeCase(value: VerificationCase | null): unknown {
  if (!value) return { found: false };
  return {
    found: true,
    id: value.id,
    status: value.status,
    rules: value.rules.map((rule) => ({
      code: rule.code,
      outcome: rule.outcome,
      message: rule.message,
    })),
    humanVerification: value.humanVerification
      ? {
          method: value.humanVerification.method,
          result: value.humanVerification.result,
          reference: value.humanVerification.reference,
          reviewerName: value.humanVerification.reviewerName,
        }
      : null,
    releasePrepared: value.releaseDocument !== null,
    signatureStatus: value.signature?.status ?? null,
  };
}

const CASE_ID_PARAMETERS = {
  type: 'object',
  properties: {
    caseId: { type: 'string', minLength: 1 },
  },
  required: ['caseId'],
  additionalProperties: false,
} as const;

export function createReviewerToolDefinitions(
  dependencies: ReviewerToolDependencies,
): ReviewerToolDefinition[] {
  return [
    {
      name: 'get_case_summary',
      description:
        'Read sanitized case status, deterministic rule outcomes, human-review state, and release/signature state.',
      parameters: CASE_ID_PARAMETERS,
      async invoke(input: unknown) {
        return summarizeCase(await dependencies.getCase(requireCaseId(input)));
      },
    },
    {
      name: 'extract_case',
      description:
        'Start document extraction and deterministic verification for a newly created case. This cannot approve exceptions or sign anything.',
      parameters: CASE_ID_PARAMETERS,
      async invoke(input: unknown) {
        const next = await dependencies.extractCase(requireCaseId(input));
        return summarizeCase(next);
      },
    },
    {
      name: 'prepare_release',
      description:
        'Request release-packet preparation through the authoritative server gate. This cannot sign or authorize payment.',
      parameters: CASE_ID_PARAMETERS,
      async invoke(input: unknown) {
        const next = await dependencies.prepareRelease(requireCaseId(input));
        return summarizeCase(next);
      },
    },
    {
      name: 'request_human_signature',
      description:
        'Create the gated Foxit eSign envelope for the configured human signer after release preparation. This requests a human signature; it cannot sign, approve verification, or authorize payment.',
      parameters: CASE_ID_PARAMETERS,
      async invoke(input: unknown) {
        const next = await dependencies.requestHumanSignature(requireCaseId(input));
        return summarizeCase(next);
      },
    },
  ];
}
