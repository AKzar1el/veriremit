import assert from 'node:assert/strict';
import test from 'node:test';

async function loadGateway() {
  return import('../src/providers/doctavian-foxit-release-gateway.ts').catch(() => ({} as Record<string, unknown>));
}

test('gated release generation runs Doctavian before Foxit and adapts approved case data to the provider envelope', async () => {
  const module = await loadGateway();
  assert.equal(typeof module.DoctavianFoxitReleaseGateway, 'function');

  const order: string[] = [];
  let doctavianInput: any;
  let foxitInput: any;
  const gateway = new (module.DoctavianFoxitReleaseGateway as new (deps: unknown) => {
    prepare(input: unknown): Promise<any>;
  })({
    doctavian: {
      async generate(input: unknown) {
        order.push('doctavian');
        doctavianInput = input;
        return {
          id: 'doctavian-generated-urn',
          filename: 'doctavian-payment-release-authorization.pdf',
          provider: 'doctavian' as const,
          bytes: new Uint8Array([37, 80, 68, 70, 45]),
        };
      },
    },
    foxit: {
      async prepare(input: unknown) {
        order.push('foxit');
        foxitInput = input;
        return {
          id: 'foxit-merged-id',
          filename: 'payment-release-authorization.pdf',
          provider: 'foxit' as const,
          localPath: '/tmp/release.pdf',
        };
      },
    },
  });

  const releaseData = {
    Release: {
      CaseId: 'case_acme_po_4821',
      Supplier: 'ACME Components GmbH',
      Checks: [{ Code: 'bank_account_continuity', Outcome: 'PASS', Summary: 'Verified by callback' }],
    },
  };
  const result = await gateway.prepare({
    releaseHtml: '<h1>fallback</h1>',
    releaseData,
    evidenceDocuments: [{ filename: 'vendor-master.pdf', bytes: new Uint8Array([1, 2, 3]) }],
    outputPath: '/tmp/release.pdf',
    outputFilename: 'payment-release-authorization.pdf',
  });

  assert.deepEqual(order, ['doctavian', 'foxit']);
  assert.equal(doctavianInput.templateFilename, 'veriremit-release-template.docx');
  assert.equal(new TextDecoder().decode(doctavianInput.templateBytes.subarray(0, 2)), 'PK');
  assert.equal(doctavianInput.dataFilename, 'veriremit-release-data.json');
  assert.deepEqual(doctavianInput.data, {
    data: {
      Release: [releaseData.Release],
    },
  });
  assert.equal(doctavianInput.outputFilename, 'doctavian-payment-release-authorization.pdf');
  assert.equal(doctavianInput.externalContextId, 'veriremit-case_acme_po_4821');

  assert.equal(foxitInput.releaseHtml, undefined);
  assert.deepEqual(foxitInput.releaseDocument, {
    filename: 'doctavian-payment-release-authorization.pdf',
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
  });
  assert.equal(foxitInput.evidenceDocuments.length, 1);
  assert.equal(foxitInput.outputPath, '/tmp/release.pdf');

  assert.deepEqual(result, {
    id: 'foxit-merged-id',
    filename: 'payment-release-authorization.pdf',
    provider: 'foxit',
    localPath: '/tmp/release.pdf',
    generation: {
      id: 'doctavian-generated-urn',
      filename: 'doctavian-payment-release-authorization.pdf',
      provider: 'doctavian',
    },
  });
});

test('Doctavian to Foxit gateway fails closed when structured release data is absent', async () => {
  const module = await loadGateway();
  assert.equal(typeof module.DoctavianFoxitReleaseGateway, 'function');
  const gateway = new (module.DoctavianFoxitReleaseGateway as new (deps: unknown) => {
    prepare(input: unknown): Promise<unknown>;
  })({
    doctavian: { async generate() { throw new Error('must not run'); } },
    foxit: { async prepare() { throw new Error('must not run'); } },
  });
  await assert.rejects(
    () => gateway.prepare({
      releaseHtml: '<h1>fallback</h1>',
      evidenceDocuments: [{ filename: 'evidence.pdf', bytes: new Uint8Array([1]) }],
      outputPath: '/tmp/release.pdf',
    }),
    /structured release data is required/i,
  );
});
