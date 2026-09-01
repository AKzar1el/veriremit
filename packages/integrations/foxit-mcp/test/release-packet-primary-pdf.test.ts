import assert from 'node:assert/strict';
import test from 'node:test';

async function loadReleasePacket() {
  return import('../src/release-packet.ts').catch(() => ({} as Record<string, unknown>));
}

function textResult(payload: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('Foxit packet accepts a Doctavian-generated PDF without re-generating it from HTML', async () => {
  const module = await loadReleasePacket();
  assert.equal(typeof module.FoxitReleasePacketGateway, 'function');

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const responses = [
    textResult({ success: true, documentId: 'doctavian-pdf' }),
    textResult({ success: true, documentId: 'evidence-pdf' }),
    textResult({ success: true, resultDocumentId: 'merged-pdf' }),
    textResult({ success: true, documentId: 'merged-pdf', outputPath: '/tmp/release.pdf' }),
  ];
  const gateway = new (module.FoxitReleasePacketGateway as new (client: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    async callToolResult(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return responses[calls.length - 1];
    },
  });

  await gateway.prepare({
    releaseDocument: {
      filename: 'doctavian-payment-release-authorization.pdf',
      bytes: new Uint8Array([37, 80, 68, 70, 45]),
    },
    evidenceDocuments: [
      { filename: 'vendor-master.pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
    ],
    outputPath: '/tmp/release.pdf',
    outputFilename: 'payment-release-authorization.pdf',
  });

  assert.deepEqual(calls.map((call) => call.name), [
    'upload_document',
    'upload_document',
    'pdf_merge',
    'download_document',
  ]);
  assert.equal(calls.some((call) => call.name === 'pdf_from_html'), false);
  assert.equal(calls[0]?.args.fileName, 'doctavian-payment-release-authorization.pdf');
  assert.equal(typeof calls[0]?.args.fileContent, 'string');
  assert.deepEqual(calls[2]?.args, {
    documents: [{ documentId: 'doctavian-pdf' }, { documentId: 'evidence-pdf' }],
  });
});
