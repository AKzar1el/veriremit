import assert from 'node:assert/strict';
import test from 'node:test';

async function loadViewer() {
  return import('../src/viewer.ts').catch(() => ({} as Record<string, unknown>));
}

test('uploads a document and returns only its DWS document id', async () => {
  const module = await loadViewer();
  assert.equal(typeof module.NutrientViewerGateway, 'function');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const gateway = new (module.NutrientViewerGateway as new (config: unknown) => {
    ensureDocument(input: unknown): Promise<{ documentId: string }>;
  })({
    apiKey: 'dws-secret',
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ data: { document_id: 'doc_dws_123', title: 'invoice' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await gateway.ensureDocument({
    filename: 'invoice-8842.pdf',
    bytes: new Uint8Array([37, 80, 68, 70]),
  });

  assert.deepEqual(result, { documentId: 'doc_dws_123' });
  assert.equal(calls[0]?.url, 'https://api.nutrient.io/viewer/documents');
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer dws-secret');
  assert.equal(headers.get('content-type'), 'application/pdf');
  assert.equal(headers.get('content-length'), '4');
  assert.equal(JSON.stringify(result).includes('dws-secret'), false);
});

test('creates a short-lived read-only session scoped to one document', async () => {
  const module = await loadViewer();
  assert.equal(typeof module.NutrientViewerGateway, 'function');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const now = new Date('2026-08-29T00:00:00.000Z');
  const gateway = new (module.NutrientViewerGateway as new (config: unknown) => {
    createSession(input: unknown): Promise<{ token: string; expiresAt?: string }>;
  })({
    apiKey: 'dws-secret',
    now: () => now,
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ jwt: 'viewer.jwt.token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await gateway.createSession({ documentId: 'doc_dws_123' });
  assert.deepEqual(result, {
    token: 'viewer.jwt.token',
    expiresAt: '2026-08-29T00:15:00.000Z',
  });
  assert.equal(calls[0]?.url, 'https://api.nutrient.io/viewer/sessions');
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer dws-secret');
  assert.equal(headers.get('content-type'), 'application/json');
  const payload = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(payload.allowed_documents, [
    { document_id: 'doc_dws_123', document_permissions: ['read'] },
  ]);
  assert.equal(payload.exp, 1787962500);
  assert.equal(JSON.stringify(result).includes('dws-secret'), false);
});

test('bounds Nutrient Viewer requests with abort signals', async () => {
  const module = await loadViewer();
  assert.equal(typeof module.NutrientViewerGateway, 'function');
  const signals: Array<AbortSignal | null | undefined> = [];
  let call = 0;
  const gateway = new (module.NutrientViewerGateway as new (config: unknown) => {
    ensureDocument(input: unknown): Promise<{ documentId: string }>;
    createSession(input: unknown): Promise<{ token: string }>;
  })({
    apiKey: 'secret',
    requestTimeoutMs: 50,
    fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => {
      signals.push(init?.signal);
      call += 1;
      return call === 1
        ? new Response(JSON.stringify({ data: { document_id: 'doc_1' } }), { status: 200 })
        : new Response(JSON.stringify({ jwt: 'token' }), { status: 200 });
    },
  });
  await gateway.ensureDocument({ filename: 'invoice.pdf', bytes: new Uint8Array([1]) });
  await gateway.createSession({ documentId: 'doc_1' });
  assert.equal(signals.length, 2);
  assert.equal(signals.every((signal) => signal instanceof AbortSignal), true);
});
