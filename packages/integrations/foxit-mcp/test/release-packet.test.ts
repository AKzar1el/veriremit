import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';
import test from 'node:test';

async function loadReleasePacket() {
  return import('../src/release-packet.ts').catch(() => ({} as Record<string, unknown>));
}

function textResult(payload: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

test('prepares and downloads a release packet through the four reversible Foxit tools in order', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const uploadSnapshots: Array<{ filename: string; bytes: Uint8Array }> = [];
  const responses = [
    textResult({ success: true, documentId: 'html-doc' }),
    textResult({ success: true, resultDocumentId: 'release-pdf' }),
    textResult({ success: true, documentId: 'evidence-pdf' }),
    textResult({ success: true, resultDocumentId: 'merged-pdf' }),
    textResult({ success: true, documentId: 'merged-pdf', outputPath: '/tmp/release.pdf', size: 4096 }),
  ];

  let fallbackCalls = 0;
  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown, mergeFallback?: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === 'upload_document') {
        assert.equal(typeof args.filePath, 'string');
        assert.equal(isAbsolute(args.filePath as string), true);
        uploadSnapshots.push({
          filename: basename(args.filePath as string),
          bytes: new Uint8Array(await readFile(args.filePath as string)),
        });
      }
      return responses[calls.length - 1];
    },
  }, {
    async merge() {
      fallbackCalls += 1;
      throw new Error('fallback must not be called');
    },
  });

  const result = await gateway.prepare({
    releaseHtml: '<h1>Payment Release Authorization</h1>',
    evidenceDocuments: [
      { filename: 'verification-record.pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
    ],
    outputPath: '/tmp/release.pdf',
    outputFilename: 'payment-release-authorization.pdf',
  }) as { id: string; filename: string; provider: string; localPath: string };

  assert.deepEqual(calls.map((call) => call.name), [
    'upload_document',
    'pdf_from_html',
    'upload_document',
    'pdf_merge',
    'download_document',
  ]);
  assert.equal(calls.some((call) => /sign|esign/i.test(call.name)), false);
  assert.equal(uploadSnapshots[0]?.filename, 'payment-release-authorization.html');
  assert.equal(new TextDecoder().decode(uploadSnapshots[0]?.bytes), '<h1>Payment Release Authorization</h1>');
  assert.match(uploadSnapshots[1]?.filename ?? '', /verification-record\.pdf$/);
  assert.deepEqual([...uploadSnapshots[1]!.bytes], [37, 80, 68, 70]);
  assert.deepEqual(calls[1]?.args, { documentId: 'html-doc' });
  assert.deepEqual(calls[3]?.args, {
    documents: [{ documentId: 'release-pdf' }, { documentId: 'evidence-pdf' }],
  });
  assert.deepEqual(calls[4]?.args, {
    documentId: 'merged-pdf',
    outputPath: '/tmp/release.pdf',
    filename: 'payment-release-authorization.pdf',
  });
  assert.deepEqual(result, {
    id: 'merged-pdf',
    filename: 'payment-release-authorization.pdf',
    provider: 'foxit',
    localPath: '/tmp/release.pdf',
  });
  assert.equal(fallbackCalls, 0);
});

test('uses the merge compatibility path only after the MCP pdf_merge validation error', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fallbackCalls: unknown[] = [];
  let uploadCount = 0;
  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown, mergeFallback?: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === 'upload_document') {
        uploadCount += 1;
        return textResult({
          success: true,
          documentId: uploadCount === 1 ? 'release-pdf' : 'evidence-pdf',
        });
      }
      if (name === 'pdf_merge') {
        return textResult({ success: false, code: 'VALIDATION_ERROR' });
      }
      if (name === 'download_document') {
        return textResult({ success: true, documentId: 'fallback-merged-pdf' });
      }
      throw new Error(`Unexpected MCP tool: ${name}`);
    },
  }, {
    async merge(documentInfos: unknown) {
      fallbackCalls.push(documentInfos);
      return 'fallback-merged-pdf';
    },
  });

  const result = await gateway.prepare({
    releaseDocument: { filename: 'release.pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
    evidenceDocuments: [
      { filename: 'evidence.pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
    ],
    outputPath: '/tmp/release.pdf',
  }) as { id: string };

  assert.deepEqual(calls.map((call) => call.name), [
    'upload_document',
    'upload_document',
    'pdf_merge',
    'download_document',
  ]);
  assert.deepEqual(fallbackCalls, [[
    { documentId: 'release-pdf' },
    { documentId: 'evidence-pdf' },
  ]]);
  assert.deepEqual(calls[3]?.args, {
    documentId: 'fallback-merged-pdf',
    outputPath: '/tmp/release.pdf',
    filename: 'payment-release-authorization.pdf',
  });
  assert.equal(result.id, 'fallback-merged-pdf');
});

test('does not use merge compatibility for non-validation MCP failures', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');
  assert.equal(typeof module.FoxitMcpError, 'function');

  let fallbackCalls = 0;
  let uploadCount = 0;
  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown, mergeFallback?: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult(name: string) {
      if (name === 'upload_document') {
        uploadCount += 1;
        return textResult({ success: true, documentId: `document-${uploadCount}` });
      }
      if (name === 'pdf_merge') {
        return textResult({ success: false, code: 'AUTHENTICATION_ERROR' });
      }
      throw new Error(`Unexpected MCP tool: ${name}`);
    },
  }, {
    async merge() {
      fallbackCalls += 1;
      return 'must-not-be-used';
    },
  });

  await assert.rejects(
    () => gateway.prepare({
      releaseDocument: { filename: 'release.pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
      evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([37, 80, 68, 70]) }],
      outputPath: '/tmp/release.pdf',
    }),
    (error: unknown) => {
      assert.equal(error instanceof (module.FoxitMcpError as new (...args: never[]) => Error), true);
      assert.equal((error as { toolName?: string }).toolName, 'pdf_merge');
      assert.equal((error as { code?: string }).code, 'AUTHENTICATION_ERROR');
      return true;
    },
  );
  assert.equal(fallbackCalls, 0);
});

test('stops immediately when a Foxit operation reports failure', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');
  assert.equal(typeof module.FoxitMcpError, 'function');

  const calls: string[] = [];
  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult(name: string) {
      calls.push(name);
      if (name === 'upload_document') {
        return textResult({ success: true, documentId: 'html-doc' });
      }
      return textResult({ success: false, error: 'conversion failed upstream', code: 'CONVERSION_FAILED' });
    },
  });

  await assert.rejects(
    () => gateway.prepare({
      releaseHtml: '<h1>Release</h1>',
      evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([1]) }],
      outputPath: '/tmp/release.pdf',
    }),
    (error: unknown) => {
      assert.equal(error instanceof (module.FoxitMcpError as new (...args: never[]) => Error), true);
      assert.match((error as Error).message, /pdf_from_html/);
      return true;
    },
  );

  assert.deepEqual(calls, ['upload_document', 'pdf_from_html']);
});

test('rejects release preparation without at least one evidence PDF', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');

  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult() {
      throw new Error('must not be called');
    },
  });

  await assert.rejects(
    () => gateway.prepare({
      releaseHtml: '<h1>Release</h1>',
      evidenceDocuments: [],
      outputPath: '/tmp/release.pdf',
    }),
    /at least one evidence document/i,
  );
});
