import assert from 'node:assert/strict';
import test from 'node:test';

async function loadClient() {
  return import('../src/client.ts').catch(() => ({} as Record<string, unknown>));
}

test('posts a grounded schema extraction request without leaking the API key into the result', async () => {
  const module = await loadClient();
  assert.equal(typeof module.NutrientExtractionClient, 'function');

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        status: 200,
        output: {
          data: { iban: 'DE72 5001 0517 5407' },
          metadata: {
            iban: {
              bbox: { x: 72, y: 330, width: 258, height: 20 },
              confidence: 0.98,
              pageIndex: 0,
              pageNumber: 1,
            },
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const client = new (module.NutrientExtractionClient as new (config: unknown) => {
    extract(input: unknown): Promise<unknown>;
  })({ apiKey: 'secret-nutrient-key', fetchImpl });

  const result = await client.extract({
    filename: 'invoice-8842.pdf',
    bytes: new TextEncoder().encode('synthetic pdf bytes'),
    kind: 'current_invoice',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://api.nutrient.io/extraction/extract');
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer secret-nutrient-key');
  assert.ok(calls[0]?.init?.body instanceof FormData);
  const instructionsPart = (calls[0]?.init?.body as FormData).get('instructions');
  assert.ok(instructionsPart instanceof Blob);
  assert.equal(instructionsPart.type, 'application/json');
  const instructions = JSON.parse(await instructionsPart.text());
  assert.equal(instructions.mode, 'understand');
  assert.equal(instructions.citationsEnabled, true);
  assert.equal(instructions.schema.type, 'object');
  assert.equal(JSON.stringify(result).includes('secret-nutrient-key'), false);
});

test('turns a non-2xx response into a credential-safe typed provider error', async () => {
  const module = await loadClient();
  assert.equal(typeof module.NutrientExtractionClient, 'function');
  assert.equal(typeof module.NutrientProviderError, 'function');

  const client = new (module.NutrientExtractionClient as new (config: unknown) => {
    extract(input: unknown): Promise<unknown>;
  })({
    apiKey: 'secret-that-must-not-leak',
    fetchImpl: async () => new Response('upstream rejected Authorization: Bearer secret-that-must-not-leak', { status: 401 }),
  });

  await assert.rejects(
    () => client.extract({
      filename: 'invoice-8842.pdf',
      bytes: new Uint8Array([1, 2, 3]),
      kind: 'current_invoice',
    }),
    (error: unknown) => {
      assert.equal(error instanceof (module.NutrientProviderError as new (...args: never[]) => Error), true);
      assert.match((error as Error).message, /status 401/);
      assert.equal((error as Error).message.includes('secret-that-must-not-leak'), false);
      return true;
    },
  );
});

test('bounds Nutrient extraction requests with an abort signal', async () => {
  const module = await loadClient();
  assert.equal(typeof module.NutrientExtractionClient, 'function');
  let signal: AbortSignal | null | undefined;
  const client = new (module.NutrientExtractionClient as new (config: unknown) => {
    extract(input: unknown): Promise<unknown>;
  })({
    apiKey: 'secret',
    requestTimeoutMs: 50,
    fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(JSON.stringify({ status: 200, output: { data: { iban: 'DE72' }, metadata: {} } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.extract({ filename: 'invoice.pdf', bytes: new Uint8Array([1]), kind: 'current_invoice' });
  assert.equal(signal instanceof AbortSignal, true);
});

test('Nutrient extraction fails boundedly when its request deadline expires', async () => {
  const module = await loadClient();
  const client = new (module.NutrientExtractionClient as new (config: unknown) => {
    extract(input: unknown): Promise<unknown>;
  })({
    apiKey: 'secret',
    requestTimeoutMs: 5,
    fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('timeout test did not abort')), 100);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        reject(init.signal?.reason ?? new Error('aborted'));
      }, { once: true });
    }),
  });
  await assert.rejects(
    () => client.extract({ filename: 'invoice.pdf', bytes: new Uint8Array([1]), kind: 'current_invoice' }),
    (error: unknown) => {
      assert.equal(error instanceof (module.NutrientProviderError as new (...args: never[]) => Error), true);
      assert.match((error as Error).message, /request failed/i);
      return true;
    },
  );
});
