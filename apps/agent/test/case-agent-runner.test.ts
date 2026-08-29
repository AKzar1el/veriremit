import assert from 'node:assert/strict';
import test from 'node:test';

test('case agent runner scopes every tool to the route case and preserves the plain user prompt', async () => {
  const module = await import('../src/agent/case-agent-runner.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.createCaseAgentRunner, 'function');
  let toolDeps: any;
  let runInput = '';
  let extractionCalls = 0;
  let signatureRequests = 0;
  const runner = (module.createCaseAgentRunner as (deps: any) => (caseId: string, prompt: string) => Promise<unknown>)({
    getCase: async (caseId: string) => ({ id: caseId, status: 'created' }),
    extractCase: async (caseId: string) => { extractionCalls += 1; return { id: caseId, status: 'review_required' }; },
    prepareRelease: async (caseId: string) => ({ id: caseId, status: 'release_prepared' }),
    requestHumanSignature: async (caseId: string) => { signatureRequests += 1; return { id: caseId, status: 'signature_pending' }; },
    createAgent: async (deps: unknown) => { toolDeps = deps; return { name: 'bounded-agent' }; },
    runAgent: async (input: { input: string }) => { runInput = input.input; return 'Bank account change detected; trusted callback required.'; },
  });

  const output = await runner('case_acme_po_4821', 'Review this packet and prepare it only if safe.');
  assert.equal(output, 'Bank account change detected; trusted callback required.');
  assert.match(runInput, /case_acme_po_4821/);
  assert.match(runInput, /Review this packet and prepare it only if safe\./);

  await toolDeps.extractCase('case_acme_po_4821');
  assert.equal(extractionCalls, 1);
  await assert.rejects(() => toolDeps.extractCase('case_other'), /scoped to case_acme_po_4821/i);
  assert.equal(extractionCalls, 1);
  await toolDeps.requestHumanSignature('case_acme_po_4821');
  assert.equal(signatureRequests, 1);
  await assert.rejects(() => toolDeps.requestHumanSignature('case_other'), /scoped to case_acme_po_4821/i);
  assert.equal(signatureRequests, 1);
});
