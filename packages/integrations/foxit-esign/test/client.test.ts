import assert from 'node:assert/strict';
import test from 'node:test';

async function loadClient() {
  return import('../src/client.ts').catch(() => ({} as Record<string, unknown>));
}

test('creates one embedded-signing envelope from the approved release PDF', async () => {
  const module = await loadClient();
  assert.equal(typeof module.FoxitEsignClient, 'function');

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new (module.FoxitEsignClient as new (config: unknown) => {
    createEnvelope(input: unknown): Promise<unknown>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        folder: {
          folderId: 16501764,
          folderStatus: 'SHARED',
          partiesList: [
            {
              emailId: 'reviewer@example.com',
              embeddedSessionURL: 'https://na1.foxitesign.foxit.com/embedded/embeddedsign?eetid=test-token',
            },
          ],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const envelope = await client.createEnvelope({
    folderName: 'VeriRemit payment release PO-4821',
    filename: 'payment-release-authorization.pdf',
    bytes: new Uint8Array([37, 80, 68, 70]),
    signer: {
      firstName: 'Demo',
      lastName: 'Controller',
      email: 'reviewer@example.com',
    },
    signSuccessUrl: 'https://veriremit.example/signing/success',
    signDeclineUrl: 'https://veriremit.example/signing/declined',
  }) as { envelopeId: string; status: string; signingUrl?: string };

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://na1.fusion.foxit.com/esign/api/v1/folders/createfolder');
  assert.equal(calls[0]?.init?.method, 'POST');
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get('client_id'), 'client-id');
  assert.equal(headers.get('client_secret'), 'client-secret');
  assert.equal(headers.get('authorization'), null);

  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(body.folderName, 'VeriRemit payment release PO-4821');
  assert.equal(body.inputType, 'base64');
  assert.deepEqual(body.fileNames, ['payment-release-authorization.pdf']);
  assert.deepEqual(body.base64FileString, ['JVBERg==']);
  assert.deepEqual(body.parties, [{
    firstName: 'Demo',
    lastName: 'Controller',
    emailId: 'reviewer@example.com',
    permission: 'FILL_FIELDS_AND_SIGN',
    sequence: 1,
  }]);
  assert.deepEqual(body.fields, [{
    type: 'signature',
    x: 108,
    y: 720,
    width: 160,
    height: 36,
    documentNumber: 1,
    pageNumber: 1,
    party: 1,
    required: true,
  }]);
  assert.equal(body.createEmbeddedSigningSession, true);
  assert.deepEqual(body.embeddedSignersEmailIds, ['reviewer@example.com']);
  assert.equal(body.sendNow, true);
  assert.equal(body.sessionExpire, true);
  assert.equal(body.expiry, 900000);
  assert.equal(body.signSuccessUrl, 'https://veriremit.example/signing/success');
  assert.equal(body.signDeclineUrl, 'https://veriremit.example/signing/declined');

  assert.deepEqual(envelope, {
    envelopeId: '16501764',
    status: 'pending',
    signingUrl: 'https://na1.foxitesign.foxit.com/embedded/embeddedsign?eetid=test-token',
  });
});

test('reads authoritative envelope status through Get Envelope Details', async () => {
  const module = await loadClient();
  assert.equal(typeof module.FoxitEsignClient, 'function');

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new (module.FoxitEsignClient as new (config: unknown) => {
    getStatus(envelopeId: string): Promise<unknown>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        result: 'success',
        folder: { folderId: 16501764, folderStatus: 'EXECUTED' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const status = await client.getStatus('16501764');
  assert.equal(calls[0]?.url, 'https://na1.fusion.foxit.com/esign/api/v1/folders/myfolder?folderId=16501764');
  assert.equal(calls[0]?.init?.method, 'GET');
  assert.deepEqual(status, { envelopeId: '16501764', status: 'completed' });
});

test('maps only documented Foxit folder statuses and fails closed on a new status', async () => {
  const module = await loadClient();
  assert.equal(typeof module.mapFoxitFolderStatus, 'function');

  const map = module.mapFoxitFolderStatus as (status: string) => string;
  assert.equal(map('DRAFT'), 'created');
  assert.equal(map('SHARED'), 'pending');
  assert.equal(map('PARTIALLY SIGNED'), 'pending');
  assert.equal(map('EXECUTED'), 'completed');
  assert.equal(map('CANCELLED'), 'voided');
  assert.equal(map('EXPIRED'), 'voided');
  assert.equal(map('DELETED'), 'voided');
  assert.throws(() => map('MYSTERY_STATUS'), /unsupported Foxit eSign status/i);
});

test('provider failures do not leak Foxit credentials, response bodies, or embedded URLs', async () => {
  const module = await loadClient();
  assert.equal(typeof module.FoxitEsignClient, 'function');
  assert.equal(typeof module.FoxitEsignError, 'function');

  const client = new (module.FoxitEsignClient as new (config: unknown) => {
    getStatus(envelopeId: string): Promise<unknown>;
  })({
    clientId: 'client-secret-must-not-leak',
    clientSecret: 'other-secret-must-not-leak',
    fetchImpl: async () => new Response(
      'client-secret-must-not-leak https://private.example/embedded?token=secret',
      { status: 401 },
    ),
  });

  await assert.rejects(
    () => client.getStatus('123'),
    (error: unknown) => {
      assert.equal(error instanceof (module.FoxitEsignError as new (...args: never[]) => Error), true);
      const message = (error as Error).message;
      assert.match(message, /status 401/);
      assert.equal(message.includes('client-secret-must-not-leak'), false);
      assert.equal(message.includes('private.example'), false);
      return true;
    },
  );
});

test('bounds Foxit eSign HTTP requests with an abort signal', async () => {
  const module = await loadClient();
  assert.equal(typeof module.FoxitEsignClient, 'function');
  let signal: AbortSignal | null | undefined;
  const client = new (module.FoxitEsignClient as new (config: unknown) => {
    getStatus(envelopeId: string): Promise<unknown>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    requestTimeoutMs: 50,
    fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(JSON.stringify({ folder: { folderId: 1, folderStatus: 'EXECUTED' } }), { status: 200 });
    },
  });
  await client.getStatus('1');
  assert.equal(signal instanceof AbortSignal, true);
});

test('Foxit eSign fails boundedly when its request deadline expires', async () => {
  const module = await loadClient();
  const client = new (module.FoxitEsignClient as new (config: unknown) => {
    getStatus(envelopeId: string): Promise<unknown>;
  })({
    clientId: 'client-id',
    clientSecret: 'client-secret',
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
    () => client.getStatus('1'),
    (error: unknown) => {
      assert.equal(error instanceof (module.FoxitEsignError as new (...args: never[]) => Error), true);
      assert.equal((error as { code?: string }).code, 'NETWORK_ERROR');
      return true;
    },
  );
});
