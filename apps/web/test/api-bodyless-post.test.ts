import assert from 'node:assert/strict';
import test from 'node:test';

import { loadOrCreateDemoCase } from '../src/api.ts';

test('bodyless demo-case POST does not advertise an empty JSON body', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; contentType: string | null }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      contentType: new Headers(init?.headers).get('content-type'),
    });

    if (requests.length === 1) {
      return new Response(JSON.stringify({
        error: { code: 'CASE_NOT_FOUND', message: 'Verification case was not found.' },
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: 'case_acme_po_4821', status: 'created' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await loadOrCreateDemoCase();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1], {
      url: '/api/cases/demo',
      method: 'POST',
      contentType: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
