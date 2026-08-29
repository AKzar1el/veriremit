import type { VerificationCase } from '@veriremit/domain';
import { createReviewerAgent, runReviewerAgent } from './reviewer-agent.ts';

interface CaseAgentActions {
  getCase(caseId: string): Promise<VerificationCase>;
  extractCase(caseId: string): Promise<VerificationCase>;
  prepareRelease(caseId: string): Promise<VerificationCase>;
  requestHumanSignature(caseId: string): Promise<VerificationCase>;
}

interface CaseAgentRunnerDependencies extends CaseAgentActions {
  createAgent?: (dependencies: {
    getCase(caseId: string): Promise<VerificationCase | null>;
    extractCase(caseId: string): Promise<VerificationCase>;
    prepareRelease(caseId: string): Promise<VerificationCase>;
    requestHumanSignature(caseId: string): Promise<VerificationCase>;
  }) => Promise<unknown>;
  runAgent?: (input: { agent: unknown; input: string }) => Promise<unknown>;
}

function scopedCaseId(expected: string, received: string): string {
  if (received !== expected) {
    throw new Error(`Agent tools are scoped to ${expected}; cross-case access is denied.`);
  }
  return received;
}

export function createCaseAgentRunner(dependencies: CaseAgentRunnerDependencies) {
  const createAgent = dependencies.createAgent ?? createReviewerAgent;
  const runAgent = dependencies.runAgent ?? runReviewerAgent;

  return async (caseId: string, prompt: string): Promise<unknown> => {
    const agent = await createAgent({
      async getCase(requestedCaseId: string) {
        return dependencies.getCase(scopedCaseId(caseId, requestedCaseId));
      },
      async extractCase(requestedCaseId: string) {
        return dependencies.extractCase(scopedCaseId(caseId, requestedCaseId));
      },
      async prepareRelease(requestedCaseId: string) {
        return dependencies.prepareRelease(scopedCaseId(caseId, requestedCaseId));
      },
      async requestHumanSignature(requestedCaseId: string) {
        return dependencies.requestHumanSignature(scopedCaseId(caseId, requestedCaseId));
      },
    });

    return runAgent({
      agent,
      input: `Case scope: ${caseId}. User prompt: ${prompt}`,
    });
  };
}
