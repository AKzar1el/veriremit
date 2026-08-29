import type { CaseStatus } from '@veriremit/domain';

const INITIAL_REVIEW_PROMPT = [
  'Review the ACME Components packet for PO-4821.',
  'If the payment details are safe, prepare the €48,620 payment-release authorization and send it to me for signature.',
  'Never release a changed bank account without human verification.',
].join(' ');

export function suggestAgentPrompt(status: CaseStatus): string {
  switch (status) {
    case 'created':
      return INITIAL_REVIEW_PROMPT;
    case 'extracting':
      return 'Summarize the extraction progress for this case. Do not assume any verification result that the server has not produced.';
    case 'review_required':
      return 'Explain why this case is blocked and what independent human verification is required before a release can be prepared.';
    case 'human_approved':
      return 'Continue the approved case: prepare the payment-release authorization if the deterministic server gate allows it, then request the configured human signature. Do not sign or authorize payment.';
    case 'release_prepared':
      return 'Request the configured human signature for the prepared release if the server gate allows it. Do not sign or authorize payment.';
    case 'signature_pending':
      return 'Summarize the current signature state. Do not treat a browser redirect as proof of completion.';
    case 'release_authorized':
      return 'Summarize the completed verification and signed release authorization. Do not claim that VeriRemit moved any money.';
    case 'rejected':
      return 'Summarize why this case was rejected and which authoritative verification event caused the rejection.';
  }
}

export function formatAgentOutput(output: unknown): string {
  if (typeof output === 'string' && output.trim()) return output.trim();
  if (output === null || output === undefined) return 'Agent completed without a text response.';
  try {
    return JSON.stringify(output);
  } catch {
    return 'Agent completed with a non-text response.';
  }
}
