import assert from 'node:assert/strict';
import test from 'node:test';

async function loadCompatibilityClient() {
  return import('../src/pdf-merge-compatibility.ts').catch(() => ({} as Record<string, unknown>));
}

test('Foxit PDF Services compatibility merge sends documentInfos and polls until COMPLETED', async () => {
  const module = await loadCompatibilityClient();
  assert.equal(typeof module.FoxitPdfServicesMergeClient, 'function');

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const responses = [
    new Response(JSON.stringify({ taskId: 'task-merge-1' }), { status: 202 }),
    new Response(JSON.stringify({ status: 'PROCESSING' }), { status: 200 }),
    new Response(JSON.stringify({ status: 'COMPLETED', resultDocumentId: 'merged-document' }), {
      status: 200,
    }),
  ];
  const waits: number[] = [];
  let elapsedMs = 0;
  const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
    merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    baseUrl: 'https://pdf.example.test/pdf-services/',
    pollIntervalMs: 25,
    now: () => elapsedMs,
    sleep: async (milliseconds: number) => {
      waits.push(milliseconds);
      elapsedMs += milliseconds;
    },
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
  });

  const result = await client.merge([
    { documentId: 'release-document' },
    { documentId: 'evidence-document' },
  ]);

  assert.equal(result, 'merged-document');
  assert.equal(calls[0]?.url, 'https://pdf.example.test/pdf-services/api/documents/enhance/pdf-combine');
  assert.equal(calls[0]?.init.method, 'POST');
  assert.deepEqual(calls[0]?.init.headers, {
    client_id: 'client-id',
    client_secret: 'client-secret',
    'content-type': 'application/json',
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    documentInfos: [
      { documentId: 'release-document' },
      { documentId: 'evidence-document' },
    ],
  });
  assert.equal('documents' in JSON.parse(String(calls[0]?.init.body)), false);
  assert.deepEqual(calls.slice(1).map((call) => ({ url: call.url, method: call.init.method })), [
    { url: 'https://pdf.example.test/pdf-services/api/tasks/task-merge-1', method: 'GET' },
    { url: 'https://pdf.example.test/pdf-services/api/tasks/task-merge-1', method: 'GET' },
  ]);
  assert.deepEqual(waits, [25]);
  assert.equal(responses.length, 0);
});

test('Foxit PDF Services compatibility merge requires HTTP 202 on submission', async () => {
  const module = await loadCompatibilityClient();
  assert.equal(typeof module.FoxitPdfServicesMergeClient, 'function');
  assert.equal(typeof module.FoxitPdfServicesError, 'function');

  const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
    merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async () => new Response(JSON.stringify({ taskId: 'unexpected-task' }), { status: 200 }),
  });

  await assert.rejects(
    () => client.merge([{ documentId: 'release-document' }]),
    (error: unknown) => {
      assert.equal(error instanceof (module.FoxitPdfServicesError as new (...args: never[]) => Error), true);
      assert.equal((error as { code?: string }).code, 'HTTP_ERROR');
      assert.equal((error as { status?: number }).status, 200);
      return true;
    },
  );
});

test('Foxit PDF Services compatibility merge fails closed when the task fails', async () => {
  const module = await loadCompatibilityClient();
  const responses = [
    new Response(JSON.stringify({ taskId: 'task-failed' }), { status: 202 }),
    new Response(JSON.stringify({ status: 'FAILED' }), { status: 200 }),
  ];
  const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
    merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async () => {
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
  });

  await assert.rejects(
    () => client.merge([{ documentId: 'release-document' }]),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'TASK_FAILED');
      return true;
    },
  );
});

test('Foxit PDF Services compatibility merge stops at its bounded polling timeout', async () => {
  const module = await loadCompatibilityClient();
  let elapsedMs = 0;
  let statusCalls = 0;
  const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
    merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    pollTimeoutMs: 100,
    pollIntervalMs: 40,
    now: () => elapsedMs,
    sleep: async (milliseconds: number) => {
      elapsedMs += milliseconds;
      if (elapsedMs > 100) throw new Error('Polling exceeded the configured timeout.');
    },
    fetchImpl: async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ taskId: 'task-processing' }), { status: 202 });
      }
      statusCalls += 1;
      if (statusCalls > 10) throw new Error('Polling did not stop.');
      return new Response(JSON.stringify({ status: 'PROCESSING' }), { status: 200 });
    },
  });

  await assert.rejects(
    () => client.merge([{ documentId: 'release-document' }]),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'TASK_TIMEOUT');
      return true;
    },
  );
  assert.equal(elapsedMs, 100);
});

test('Foxit PDF Services compatibility merge rejects malformed or missing task identifiers', async (context) => {
  const module = await loadCompatibilityClient();
  const invalidSubmissions = [
    {
      name: 'invalid JSON',
      response: new Response('not-json', { status: 202 }),
      code: 'INVALID_JSON',
    },
    {
      name: 'missing taskId',
      response: new Response(JSON.stringify({}), { status: 202 }),
      code: 'MISSING_TASK_ID',
    },
    {
      name: 'blank taskId',
      response: new Response(JSON.stringify({ taskId: '  ' }), { status: 202 }),
      code: 'MISSING_TASK_ID',
    },
  ];

  for (const fixture of invalidSubmissions) {
    await context.test(fixture.name, async () => {
      const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
        merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
      })({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: async () => fixture.response,
      });
      await assert.rejects(
        () => client.merge([{ documentId: 'release-document' }]),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, fixture.code);
          return true;
        },
      );
    });
  }
});

test('Foxit PDF Services compatibility merge rejects malformed completion results', async (context) => {
  const module = await loadCompatibilityClient();
  const invalidTasks = [
    {
      name: 'missing resultDocumentId',
      response: new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 }),
      code: 'MISSING_RESULT_ID',
    },
    {
      name: 'invalid task status',
      response: new Response(JSON.stringify({ status: 'UNKNOWN' }), { status: 200 }),
      code: 'INVALID_TASK_STATUS',
    },
    {
      name: 'invalid task JSON',
      response: new Response('not-json', { status: 200 }),
      code: 'INVALID_JSON',
    },
  ];

  for (const fixture of invalidTasks) {
    await context.test(fixture.name, async () => {
      const responses = [
        new Response(JSON.stringify({ taskId: 'task-invalid-result' }), { status: 202 }),
        fixture.response,
      ];
      const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
        merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
      })({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        fetchImpl: async () => {
          const response = responses.shift();
          assert.ok(response);
          return response;
        },
      });
      await assert.rejects(
        () => client.merge([{ documentId: 'release-document' }]),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, fixture.code);
          return true;
        },
      );
    });
  }
});

test('Foxit PDF Services compatibility merge fails closed on polling HTTP errors', async () => {
  const module = await loadCompatibilityClient();
  const responses = [
    new Response(JSON.stringify({ taskId: 'task-http-error' }), { status: 202 }),
    new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }),
  ];
  const client = new (module.FoxitPdfServicesMergeClient as new (config: unknown) => {
    merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async () => {
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
  });

  await assert.rejects(
    () => client.merge([{ documentId: 'release-document' }]),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'HTTP_ERROR');
      assert.equal((error as { status?: number }).status, 503);
      return true;
    },
  );
});
