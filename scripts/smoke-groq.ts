import { createDemoCase, DEMO_CASE_ID } from '../apps/agent/src/demo/create-demo-case.ts';
import { createReviewerAgent, runReviewerAgent } from '../apps/agent/src/agent/reviewer-agent.ts';

function requireGroqKey(): void {
  if (!process.env.GROQ_API_KEY?.trim()) throw new Error('Missing GROQ_API_KEY.');
}

async function main(): Promise<void> {
  requireGroqKey();
  const demo = createDemoCase('2026-09-01T12:00:00.000Z');
  let summaryReads = 0;

  const agent = await createReviewerAgent({
    async getCase(caseId: string) {
      summaryReads += 1;
      return caseId === DEMO_CASE_ID ? demo : null;
    },
    async extractCase() {
      throw new Error('Groq smoke must not start extraction.');
    },
    async prepareRelease() {
      throw new Error('Groq smoke must not prepare release.');
    },
    async requestHumanSignature() {
      throw new Error('Groq smoke must not request a signature.');
    },
  });

  const output = await runReviewerAgent({
    agent,
    input: `Use get_case_summary for ${DEMO_CASE_ID}, then briefly explain the current case status. Do not call any other tool.`,
  });

  if (summaryReads !== 1) {
    throw new Error(`Groq reviewer did not use exactly one bounded summary tool call (observed ${summaryReads}).`);
  }
  if (typeof output !== 'string' || output.trim().length === 0) {
    throw new Error('Groq reviewer returned no final text.');
  }

  console.log('Groq bounded reviewer live smoke succeeded.');
  console.log('Model output and credential intentionally not printed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Groq live smoke failed.');
  process.exitCode = 2;
});
