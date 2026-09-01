import assert from 'node:assert/strict';
import test from 'node:test';

async function loadLiveRuntime() {
  return import('../src/live-runtime-actions.ts').catch(() => ({} as Record<string, unknown>));
}

test('live provider bootstrap fails closed with the exact missing credential names before provider startup', async () => {
  const module = await loadLiveRuntime();
  assert.equal(typeof module.assertLiveProviderConfig, 'function');

  assert.throws(
    () => (module.assertLiveProviderConfig as (config: Record<string, unknown>) => unknown)({
      providerMode: 'live',
      publicBaseUrl: 'https://demo.example',
      dataDir: '.data',
    }),
    /NUTRIENT_API_KEY, NUTRIENT_DWS_VIEWER_API_KEY, FOXIT_CLIENT_ID, FOXIT_CLIENT_SECRET, DOCTAVIAN_API_KEY, GROQ_API_KEY, VERIREMIT_SIGNER_EMAIL/,
  );
});

import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExtractedDocument, HumanVerification, VerificationCase } from '@veriremit/domain';

test('live actions use injected sponsor gateways through the authoritative case workflow and cache viewer uploads', async () => {
  const module = await loadLiveRuntime();
  assert.equal(typeof module.createLiveRuntimeActions, 'function');

  const dataDir = await mkdtemp(join(tmpdir(), 'veriremit-live-runtime-'));
  const fixtureDir = join(process.cwd(), 'fixtures/acme-components');
  const raw = JSON.parse(await readFile(join(fixtureDir, 'fixture-extraction.json'), 'utf8')) as {
    documents: ExtractedDocument[];
  };
  const byKind = new Map(raw.documents.map((document) => [document.kind, document]));
  let viewerUploads = 0;
  let closeCalls = 0;
  let signSuccessUrl: string | undefined;
  let receivedReleaseData: any;

  const providers = {
    extractor: {
      async extract(input: { filename: string; bytes: Uint8Array; kind: VerificationCase['documents'][number]['kind'] }) {
        void input.bytes;
        const document = byKind.get(input.kind);
        assert.ok(document);
        return { ...document, filename: input.filename, mode: 'live' as const };
      },
    },
    viewer: {
      async ensureDocument() {
        viewerUploads += 1;
        return { documentId: 'dws-vendor-master' };
      },
      async createSession(input: { documentId: string }) {
        return { token: `live-session:${input.documentId}`, expiresAt: '2026-08-29T02:15:00.000Z' };
      },
    },
    releaseGateway: {
      async prepare(input: { outputPath: string; outputFilename?: string; releaseData?: Readonly<Record<string, unknown>> }) {
        receivedReleaseData = input.releaseData;
        await mkdir(dirname(input.outputPath), { recursive: true });
        await writeFile(input.outputPath, '%PDF-1.4\n% live gateway test\n', { mode: 0o600 });
        return {
          id: 'foxit-live-release-1',
          filename: input.outputFilename ?? 'payment-release-authorization.pdf',
          provider: 'foxit' as const,
          localPath: input.outputPath,
          generation: {
            id: 'doctavian-live-generation-1',
            filename: 'doctavian-payment-release-authorization.pdf',
            provider: 'doctavian' as const,
          },
        };
      },
    },
    signatureGateway: {
      async createEnvelope(input: { signSuccessUrl: string }) {
        signSuccessUrl = input.signSuccessUrl;
        return { envelopeId: '12345', status: 'pending' as const, signingUrl: 'https://sign.example/session' };
      },
      async getStatus(envelopeId: string) {
        return { envelopeId, status: 'completed' as const };
      },
    },
    async close() { closeCalls += 1; },
  };

  try {
    const runtime = await (module.createLiveRuntimeActions as (options: any) => Promise<any>)({
      config: {
        host: '127.0.0.1',
        port: 8787,
        dataDir,
        providerMode: 'live',
        logger: false,
        publicBaseUrl: 'https://agent.example',
        webOrigin: 'https://veriremit.example',
        nutrientApiKey: 'nutrient-test',
        nutrientViewerApiKey: 'viewer-test',
        foxitClientId: 'foxit-client-test',
        foxitClientSecret: 'foxit-secret-test',
        doctavianApiKey: 'doctavian-test',
        groqApiKey: 'gsk-test',
        signerEmail: 'controller@example.com',
      },
      fixtureDir,
      providers,
      now: () => '2026-08-29T02:00:00.000Z',
    });

    await runtime.actions.createDemoCase();
    const reviewed = await runtime.actions.extract('case_acme_po_4821');
    assert.equal(reviewed.status, 'review_required');
    assert.equal(reviewed.documents.every((document: ExtractedDocument) => document.mode === 'live'), true);
    assert.equal(reviewed.rules.find((rule: { code: string }) => rule.code === 'bank_account_continuity')?.outcome, 'BLOCK');

    const vendor = reviewed.documents.find((document: ExtractedDocument) => document.kind === 'vendor_master');
    assert.ok(vendor);
    const trusted = vendor.facts.find((fact: ExtractedDocument['facts'][number]) => fact.field === 'trusted_phone');
    assert.ok(trusted);
    const verification: HumanVerification = {
      method: 'trusted_callback',
      reference: 'VR-LIVE-4821',
      result: 'confirmed',
      reviewerName: 'Demo Controller',
      trustedContactSource: trusted.source,
      recordedAt: '2026-08-29T02:00:00.000Z',
    };
    await runtime.actions.recordReview('case_acme_po_4821', verification);

    const viewerA = await runtime.actions.createViewerSession(vendor.id);
    const viewerB = await runtime.actions.createViewerSession(vendor.id);
    assert.equal(viewerA.mode, 'live');
    assert.equal(viewerB.mode, 'live');
    assert.equal(viewerUploads, 1);

    assert.equal((await runtime.actions.prepareRelease('case_acme_po_4821')).status, 'release_prepared');
    assert.equal(receivedReleaseData?.Release?.CaseId, 'case_acme_po_4821');
    assert.equal(receivedReleaseData?.Release?.Supplier, 'ACME Components GmbH');
    assert.equal(receivedReleaseData?.Release?.VendorId, 'V-1042');
    assert.equal(receivedReleaseData?.Release?.PoNumber, 'PO-4821');
    assert.equal(receivedReleaseData?.Release?.Amount, '48620.00');
    assert.equal(receivedReleaseData?.Release?.Currency, 'EUR');
    assert.equal(receivedReleaseData?.Release?.Iban, 'DE72 5001 0517 5407');
    assert.equal(receivedReleaseData?.Release?.ReviewerName, 'Demo Controller');
    assert.equal(receivedReleaseData?.Release?.VerificationReference, 'VR-LIVE-4821');
    assert.equal(receivedReleaseData?.Release?.VerifiedAt, '2026-08-29T02:00:00.000Z');
    assert.ok(Array.isArray(receivedReleaseData?.Release?.Checks));
    assert.ok(receivedReleaseData.Release.Checks.length > 0);

    const pending = await runtime.actions.sign('case_acme_po_4821');
    assert.equal(pending.status, 'signature_pending');
    assert.equal(pending.signature?.signingUrl, 'https://sign.example/session');
    assert.equal(signSuccessUrl, 'https://veriremit.example/signing/success');
    assert.equal((await runtime.actions.refreshSignature('case_acme_po_4821')).status, 'release_authorized');
    assert.equal((await runtime.actions.verifyAudit('case_acme_po_4821')).valid, true);

    await runtime.close();
    assert.equal(closeCalls, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('Foxit MCP runtime paths are anchored to the repository rather than process cwd', async () => {
  const module = await loadLiveRuntime();
  assert.equal(typeof module.resolveFoxitMcpRuntimePaths, 'function');
  const paths = (module.resolveFoxitMcpRuntimePaths as () => { cwd: string; serverEntryPath: string })();
  assert.equal(paths.cwd, process.cwd());
  assert.equal(
    paths.serverEntryPath,
    join(process.cwd(), 'node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js'),
  );
});
