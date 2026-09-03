import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';

async function loadPromptModel() {
  return import('../src/agent-prompt-model.ts').catch(() => ({} as Record<string, unknown>));
}

test('agent prompt suggestions follow the authoritative case stage without asking the model to sign', async () => {
  const module = await loadPromptModel();
  assert.equal(typeof module.suggestAgentPrompt, 'function');
  const suggest = module.suggestAgentPrompt as (status: VerificationCase['status']) => string;

  const initial = suggest('created');
  assert.match(initial, /Review the ACME Components packet for PO-4821/);
  assert.match(initial, /run the document review/i);
  assert.match(initial, /Never release a changed bank account without independent human verification/);
  assert.doesNotMatch(initial, /prepare the .*payment-release authorization/i);
  assert.doesNotMatch(initial, /send it to me for signature/i);
  assert.doesNotMatch(initial, /sign it yourself/i);

  const blocked = suggest('review_required');
  assert.match(blocked, /Explain why this case is blocked/);
  assert.match(blocked, /human verification/i);

  const approved = suggest('human_approved');
  assert.match(approved, /prepare the payment-release authorization/i);
  assert.match(approved, /deterministic server gate allows/i);
  assert.match(approved, /request the configured human signature/i);

  const prepared = suggest('release_prepared');
  assert.match(prepared, /request the configured human signature/i);
  assert.match(prepared, /Do not sign/i);
});

test('agent output formatter stays concise and deterministic for non-string SDK output', async () => {
  const module = await loadPromptModel();
  assert.equal(typeof module.formatAgentOutput, 'function');
  const format = module.formatAgentOutput as (output: unknown) => string;
  assert.equal(format('Blocked pending callback.'), 'Blocked pending callback.');
  assert.equal(format({ status: 'review_required' }), '{"status":"review_required"}');
  assert.equal(format(null), 'Agent completed without a text response.');
});
