import assert from 'node:assert/strict';
import test from 'node:test';

async function loadClient() {
  return import('../src/providers/doctavian-client.ts').catch(() => ({} as Record<string, unknown>));
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Doctavian uploads template and structured data, generates PDF, then downloads it with X-Api-Key only', async () => {
  const module = await loadClient();
  assert.equal(typeof module.DoctavianGenerationClient, 'function');

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const pdf = new TextEncoder().encode('%PDF-1.7\nsynthetic-doctavian-output');
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/v1/documents/template/upload')) {
      return jsonResponse({ result: { data: { files: [{ id: 'template-urn' }] } } }, 201);
    }
    if (url.endsWith('/v1/documents/data/upload')) {
      return jsonResponse({ result: { data: { files: [{ id: 'data-urn' }] } } }, 201);
    }
    if (url.endsWith('/v1/documents/document/generate')) {
      return jsonResponse({ result: { data: { document: { urn: 'generated-urn' } } } }, 201);
    }
    if (url.endsWith('/v1/documents/document/generated-urn/download')) {
      return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } });
    }
    throw new Error(`Unexpected Doctavian URL: ${url}`);
  };

  const client = new (module.DoctavianGenerationClient as new (config: unknown) => {
    generate(input: unknown): Promise<any>;
  })({
    apiKey: 'doctavian-test-key',
    fetchImpl,
    baseUrl: 'https://demo.api.doctavian.com',
  });

  const result = await client.generate({
    templateFilename: 'veriremit-release-template.docx',
    templateBytes: new Uint8Array([80, 75, 3, 4]),
    dataFilename: 'veriremit-release-data.json',
    data: {
      Release: {
        CaseId: 'case_acme_po_4821',
        Supplier: 'ACME Components GmbH',
        Checks: [
          { Code: 'bank_account_continuity', Outcome: 'BLOCK' },
          { Code: 'human_verification', Outcome: 'PASS' },
        ],
      },
    },
    outputFilename: 'payment-release-authorization.pdf',
    externalContextId: 'veriremit-case_acme_po_4821',
  });

  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => [call.init?.method ?? 'GET', call.url]), [
    ['POST', 'https://demo.api.doctavian.com/v1/documents/template/upload'],
    ['POST', 'https://demo.api.doctavian.com/v1/documents/data/upload'],
    ['POST', 'https://demo.api.doctavian.com/v1/documents/document/generate'],
    ['GET', 'https://demo.api.doctavian.com/v1/documents/document/generated-urn/download'],
  ]);

  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get('x-api-key'), 'doctavian-test-key');
    assert.equal(headers.has('authorization'), false);
  }

  assert.ok(calls[0]?.init?.body instanceof FormData);
  assert.ok(calls[1]?.init?.body instanceof FormData);
  const templatePart = (calls[0]?.init?.body as FormData).get('file');
  const dataPart = (calls[1]?.init?.body as FormData).get('file');
  assert.ok(templatePart instanceof Blob);
  assert.ok(dataPart instanceof Blob);
  assert.equal(await (dataPart as Blob).text(), JSON.stringify({
    Release: {
      CaseId: 'case_acme_po_4821',
      Supplier: 'ACME Components GmbH',
      Checks: [
        { Code: 'bank_account_continuity', Outcome: 'BLOCK' },
        { Code: 'human_verification', Outcome: 'PASS' },
      ],
    },
  }));

  const generateBody = JSON.parse(String(calls[2]?.init?.body));
  assert.equal(generateBody.externalContext.id, 'veriremit-case_acme_po_4821');
  assert.deepEqual(generateBody.template, {
    name: 'veriremit-release-template.docx',
    urn: 'template-urn',
    fileFormat: 'docx',
    loadMethod: 'Storage',
    options: {},
  });
  assert.deepEqual(generateBody.data, { loadMethod: 'Storage', urn: 'data-urn' });
  assert.deepEqual(generateBody.document, {
    name: 'payment-release-authorization',
    fileFormat: 'pdf',
    deliveryMethod: 'Storage',
    path: 'root',
    locale: 'en',
    timezone: 'Europe/Ljubljana',
    options: {},
  });

  assert.equal(result.id, 'generated-urn');
  assert.equal(result.filename, 'payment-release-authorization.pdf');
  assert.equal(result.provider, 'doctavian');
  assert.equal(new TextDecoder().decode(result.bytes), '%PDF-1.7\nsynthetic-doctavian-output');
});

test('Doctavian failures are bounded and never echo the API key or provider body', async () => {
  const module = await loadClient();
  assert.equal(typeof module.DoctavianGenerationClient, 'function');
  assert.equal(typeof module.DoctavianProviderError, 'function');

  const client = new (module.DoctavianGenerationClient as new (config: unknown) => {
    generate(input: unknown): Promise<unknown>;
  })({
    apiKey: 'doctavian-secret-that-must-not-leak',
    fetchImpl: async () => new Response(
      'upstream rejected X-Api-Key doctavian-secret-that-must-not-leak',
      { status: 401 },
    ),
  });

  await assert.rejects(
    () => client.generate({
      templateFilename: 'template.docx',
      templateBytes: new Uint8Array([1]),
      dataFilename: 'data.json',
      data: { Release: {} },
      outputFilename: 'release.pdf',
      externalContextId: 'case-1',
    }),
    (error: unknown) => {
      assert.equal(error instanceof (module.DoctavianProviderError as new (...args: never[]) => Error), true);
      assert.match((error as Error).message, /template upload failed with status 401/i);
      assert.equal((error as Error).message.includes('doctavian-secret-that-must-not-leak'), false);
      assert.equal((error as Error).message.includes('upstream rejected'), false);
      return true;
    },
  );
});
