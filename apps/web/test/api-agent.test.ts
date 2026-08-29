import assert from 'node:assert/strict';
import test from 'node:test';

test('runCaseAgent posts one bounded plain prompt to the case-scoped agent endpoint', async () => {
  const module = await import('../src/api.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.runCaseAgent, 'function');

  const originalFetch = globalThis.fetch;
  let captured: { url: string; method?: string; body?: string } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = {
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    return new Response(JSON.stringify({ output: 'Payment release remains blocked pending trusted callback.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const response = await (module.runCaseAgent as (caseId: string, prompt: string) => Promise<unknown>)(
      'case_acme_po_4821',
      'Review this packet.',
    );
    assert.deepEqual(captured, {
      url: '/api/cases/case_acme_po_4821/agent',
      method: 'POST',
      body: JSON.stringify({ prompt: 'Review this packet.' }),
    });
    assert.deepEqual(response, {
      output: 'Payment release remains blocked pending trusted callback.',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
