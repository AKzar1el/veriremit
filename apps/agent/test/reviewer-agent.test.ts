import assert from 'node:assert/strict';
import test from 'node:test';

async function loadAgentModules() {
  const [reviewer, tools] = await Promise.all([
    import('../src/agent/reviewer-agent.ts').catch(() => ({} as Record<string, unknown>)),
    import('../src/agent/tools.ts').catch(() => ({} as Record<string, unknown>)),
  ]);
  return { reviewer, tools };
}

test('reviewer tool boundary exposes only case inspection, extraction, gated release preparation, and human-signature request', async () => {
  const { tools } = await loadAgentModules();
  assert.equal(typeof tools.createReviewerToolDefinitions, 'function');

  const definitions = (tools.createReviewerToolDefinitions as (deps: unknown) => Array<{ name: string }>)({
    getCase: async () => ({ id: 'case_acme_po_4821', status: 'review_required' }),
    extractCase: async () => ({ id: 'case_acme_po_4821', status: 'review_required' }),
    prepareRelease: async () => ({ id: 'case_acme_po_4821', status: 'release_prepared' }),
    requestHumanSignature: async () => ({ id: 'case_acme_po_4821', status: 'signature_pending' }),
  });

  const names = definitions.map((tool) => tool.name).sort();
  assert.deepEqual(names, ['extract_case', 'get_case_summary', 'prepare_release', 'request_human_signature']);
  assert.equal(names.includes('sign'), false);
  assert.equal(names.includes('esign'), false);
  for (const forbidden of ['shell', 'fetch', 'http', 'exec']) {
    assert.equal(names.some((name) => name.toLowerCase().includes(forbidden)), false);
  }
});

test('prepare_release delegates to the authoritative CaseService gate and cannot bypass denial', async () => {
  const { tools } = await loadAgentModules();
  assert.equal(typeof tools.createReviewerToolDefinitions, 'function');

  let calls = 0;
  const releaseError = Object.assign(new Error('Human verification required.'), {
    code: 'RELEASE_BLOCKED',
    statusCode: 409,
    details: ['bank_account_continuity'],
  });
  const definitions = (tools.createReviewerToolDefinitions as (deps: unknown) => Array<{
    name: string;
    invoke(args: unknown): Promise<unknown>;
  }>)({
    getCase: async () => ({ id: 'case_acme_po_4821', status: 'review_required' }),
    prepareRelease: async () => {
      calls += 1;
      throw releaseError;
    },
  });

  const prepare = definitions.find((tool) => tool.name === 'prepare_release');
  assert.ok(prepare);
  await assert.rejects(
    () => prepare.invoke({ caseId: 'case_acme_po_4821' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'RELEASE_BLOCKED');
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('request_human_signature delegates to the authoritative envelope gate but never signs the document', async () => {
  const { tools } = await loadAgentModules();
  let calls = 0;
  const definitions = (tools.createReviewerToolDefinitions as (deps: unknown) => Array<{
    name: string;
    invoke(args: unknown): Promise<any>;
  }>)({
    getCase: async () => ({ id: 'case_acme_po_4821', status: 'release_prepared' }),
    extractCase: async () => ({ id: 'case_acme_po_4821', status: 'review_required' }),
    prepareRelease: async () => ({ id: 'case_acme_po_4821', status: 'release_prepared' }),
    requestHumanSignature: async () => {
      calls += 1;
      return {
        id: 'case_acme_po_4821',
        status: 'signature_pending',
        rules: [],
        humanVerification: null,
        releaseDocument: { id: 'doc_release', filename: 'release.pdf', provider: 'foxit' },
        signature: { envelopeId: 'env_1', status: 'pending', signingUrl: 'https://sign.example/secret' },
      };
    },
  });

  const requestSignature = definitions.find((tool) => tool.name === 'request_human_signature');
  assert.ok(requestSignature);
  const result = await requestSignature.invoke({ caseId: 'case_acme_po_4821' });
  assert.equal(calls, 1);
  assert.equal(result.signatureStatus, 'pending');
  assert.equal(JSON.stringify(result).includes('https://sign.example/secret'), false);
});

test('reviewer agent configuration is pinned to the cheapest bounded model profile', async () => {
  const { reviewer } = await loadAgentModules();
  assert.equal(typeof reviewer.createReviewerAgentConfig, 'function');

  const config = (reviewer.createReviewerAgentConfig as (input?: unknown) => {
    model: string;
    modelSettings: Record<string, any>;
    instructions: string;
  })();

  assert.equal(config.model, 'gpt-5-nano');
  assert.equal(config.modelSettings.maxTokens, 256);
  assert.equal(config.modelSettings.reasoning.effort, 'minimal');
  assert.equal(config.modelSettings.text.verbosity, 'low');
  assert.equal(config.modelSettings.parallelToolCalls, false);
  assert.equal(config.modelSettings.store, false);
  assert.equal('retry' in config.modelSettings, false);
  assert.match(config.instructions, /never decide pass or fail/i);
  assert.match(config.instructions, /human must perform the actual signature/i);
  assert.match(config.instructions, /cannot sign/i);
});

test('reviewer runs are hard-capped to three turns to bound cost and loops', async () => {
  const { reviewer } = await loadAgentModules();
  assert.equal(typeof reviewer.runReviewerAgent, 'function');

  let captured: unknown;
  const result = await (reviewer.runReviewerAgent as (input: unknown) => Promise<unknown>)({
    agent: { name: 'fake-agent' },
    input: 'Explain the current case.',
    run: async (_agent: unknown, _input: unknown, options: unknown) => {
      captured = options;
      return { finalOutput: 'Blocked pending callback.' };
    },
  });

  assert.deepEqual(captured, { maxTurns: 3 });
  assert.equal(result, 'Blocked pending callback.');
});
