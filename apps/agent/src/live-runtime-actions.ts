import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendEvent, verifyLedger } from '@veriremit/audit';
import type { DocumentKind, ExtractedDocument, HumanVerification, VerificationCase } from '@veriremit/domain';
import {
  NutrientExtractionClient,
  NutrientViewerGateway,
} from '../../../packages/integrations/nutrient/src/index.ts';
import {
  createFoxitMcpServer,
  FoxitReleasePacketGateway,
} from '../../../packages/integrations/foxit-mcp/src/index.ts';
import { FoxitEsignClient } from '../../../packages/integrations/foxit-esign/src/index.ts';
import type { AgentConfig } from './config.ts';
import { createDemoCase, DEMO_CASE_ID } from './demo/create-demo-case.ts';
import { FilesystemAuditRepository } from './repository/filesystem-audit-repository.ts';
import { FilesystemCaseRepository } from './repository/filesystem-case-repository.ts';
import { CaseService, CaseServiceError } from './services/case-service.ts';

export interface LiveProviderConfig {
  nutrientApiKey: string;
  nutrientViewerApiKey: string;
  foxitClientId: string;
  foxitClientSecret: string;
  signerEmail: string;
}

interface DocumentExtractor {
  extract(input: { filename: string; bytes: Uint8Array; kind: DocumentKind }): Promise<ExtractedDocument>;
}

interface ViewerGateway {
  ensureDocument(input: { filename: string; bytes: Uint8Array }): Promise<{ documentId: string }>;
  createSession(input: { documentId: string }): Promise<{ token: string; expiresAt?: string }>;
}

interface ReleasePacketGateway {
  prepare(input: {
    releaseHtml: string;
    evidenceDocuments: Array<{ filename: string; bytes: Uint8Array }>;
    outputPath: string;
    outputFilename?: string;
  }): Promise<{ id: string; filename: string; provider: 'foxit'; localPath: string }>;
}

interface SignatureGateway {
  createEnvelope(input: {
    folderName: string;
    filename: string;
    bytes: Uint8Array;
    signer: { firstName: string; lastName: string; email: string };
    signSuccessUrl: string;
    signDeclineUrl: string;
  }): Promise<{ envelopeId: string; status: 'created' | 'pending' | 'completed' | 'declined' | 'voided'; signingUrl?: string }>;
  getStatus(envelopeId: string): Promise<{ envelopeId: string; status: 'created' | 'pending' | 'completed' | 'declined' | 'voided' }>;
}

export interface LiveRuntimeProviders {
  extractor: DocumentExtractor;
  viewer: ViewerGateway;
  releaseGateway: ReleasePacketGateway;
  signatureGateway: SignatureGateway;
  close(): Promise<void>;
}

export interface LiveRuntimeOptions {
  config: AgentConfig;
  fixtureDir?: string;
  providers?: LiveRuntimeProviders;
  now?: () => string;
}

const LIVE_DEMO_FILES: ReadonlyArray<{ filename: string; kind: DocumentKind }> = [
  { filename: 'vendor-master.pdf', kind: 'vendor_master' },
  { filename: 'purchase-order-4821.pdf', kind: 'purchase_order' },
  { filename: 'previous-invoice.pdf', kind: 'previous_invoice' },
  { filename: 'invoice-8842.pdf', kind: 'current_invoice' },
  { filename: 'bank-change-letter.pdf', kind: 'bank_change_letter' },
];

export function resolveFoxitMcpRuntimePaths(): { cwd: string; serverEntryPath: string } {
  const cwd = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
  return {
    cwd,
    serverEntryPath: join(cwd, 'node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js'),
  };
}

interface FoxitMcpRuntime {
  connect(): Promise<void>;
  close(): Promise<void>;
  callToolResult(toolName: string, args: Record<string, unknown> | null): Promise<unknown>;
}

export function assertLiveProviderConfig(config: Partial<AgentConfig>): LiveProviderConfig {
  const required = [
    ['NUTRIENT_API_KEY', config.nutrientApiKey],
    ['NUTRIENT_DWS_VIEWER_API_KEY', config.nutrientViewerApiKey],
    ['FOXIT_CLIENT_ID', config.foxitClientId],
    ['FOXIT_CLIENT_SECRET', config.foxitClientSecret],
    ['VERIREMIT_SIGNER_EMAIL', config.signerEmail],
  ] as const;
  const missing = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Live provider runtime requires: ${missing.join(', ')}.`);
  }
  return {
    nutrientApiKey: config.nutrientApiKey!,
    nutrientViewerApiKey: config.nutrientViewerApiKey!,
    foxitClientId: config.foxitClientId!,
    foxitClientSecret: config.foxitClientSecret!,
    signerEmail: config.signerEmail!,
  };
}

async function createDefaultLiveProviders(config: AgentConfig): Promise<LiveRuntimeProviders> {
  const credentials = assertLiveProviderConfig(config);
  const mcpPaths = resolveFoxitMcpRuntimePaths();
  const mcp = await createFoxitMcpServer({
    clientId: credentials.foxitClientId,
    clientSecret: credentials.foxitClientSecret,
    ...(config.foxitApiHost ? { apiBaseUrl: config.foxitApiHost } : {}),
    cwd: mcpPaths.cwd,
    serverEntryPath: mcpPaths.serverEntryPath,
  }) as FoxitMcpRuntime;

  try {
    await mcp.connect();
  } catch (error) {
    await mcp.close().catch(() => undefined);
    throw error;
  }

  return {
    extractor: new NutrientExtractionClient({ apiKey: credentials.nutrientApiKey }),
    viewer: new NutrientViewerGateway({ apiKey: credentials.nutrientViewerApiKey }),
    releaseGateway: new FoxitReleasePacketGateway(mcp),
    signatureGateway: new FoxitEsignClient({
      clientId: credentials.foxitClientId,
      clientSecret: credentials.foxitClientSecret,
      ...(config.foxitEsignHost ? { baseUrl: config.foxitEsignHost } : {}),
    }),
    async close() { await mcp.close(); },
  };
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function factValue(value: VerificationCase, kind: DocumentKind, field: string): string {
  const fact = value.documents.find((document) => document.kind === kind)?.facts.find((item) => item.field === field);
  if (!fact) throw new CaseServiceError('EVIDENCE_MISSING', `Required extracted field ${field} is missing.`, 409);
  return String(fact.value);
}

function releaseHtml(value: VerificationCase): string {
  const supplier = factValue(value, 'vendor_master', 'beneficiary_name');
  const poNumber = factValue(value, 'current_invoice', 'po_number');
  const amount = factValue(value, 'current_invoice', 'amount');
  const currency = factValue(value, 'current_invoice', 'currency');
  const requestedIban = factValue(value, 'current_invoice', 'iban');
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>Payment Release Authorization</title></head><body>',
    `<h1>Payment Release Authorization - ${htmlEscape(poNumber)}</h1>`,
    `<p><strong>Supplier:</strong> ${htmlEscape(supplier)}</p>`,
    `<p><strong>Amount:</strong> ${htmlEscape(amount)} ${htmlEscape(currency)}</p>`,
    `<p><strong>Verified payment account:</strong> ${htmlEscape(requestedIban)}</p>`,
    '<p>Vendor bank-account change independently verified by a human using the trusted vendor-master contact before this document was prepared.</p>',
    '<p>VeriRemit authorizes a human signature workflow only. It does not execute or transmit payment.</p>',
    '</body></html>',
  ].join('');
}

export async function createLiveRuntimeActions(options: LiveRuntimeOptions) {
  const credentials = assertLiveProviderConfig(options.config);
  const providers = options.providers ?? await createDefaultLiveProviders(options.config);
  const now = options.now ?? (() => new Date().toISOString());
  const fixtureDir = resolve(options.fixtureDir ?? 'fixtures/acme-components');
  const dataDir = resolve(options.config.dataDir);
  const cases = new FilesystemCaseRepository(join(dataDir, 'cases'));
  const audits = new FilesystemAuditRepository(join(dataDir, 'audit'));
  const viewerDocumentIds = new Map<string, string>();
  const service = new CaseService({
    cases,
    audits,
    extractor: providers.extractor,
    releaseGateway: providers.releaseGateway,
    signatureGateway: providers.signatureGateway,
    now,
  });

  async function requireCase(caseId: string): Promise<VerificationCase> {
    const value = await cases.get(caseId);
    if (!value) throw new CaseServiceError('CASE_NOT_FOUND', 'Verification case was not found.', 404);
    return value;
  }

  async function liveFiles(): Promise<Array<{ filename: string; kind: DocumentKind; bytes: Uint8Array }>> {
    return Promise.all(LIVE_DEMO_FILES.map(async (document) => ({
      ...document,
      bytes: new Uint8Array(await readFile(join(fixtureDir, document.filename))),
    })));
  }

  const actions = {
    async createDemoCase(): Promise<VerificationCase> {
      const existing = await cases.get(DEMO_CASE_ID);
      if (existing) return existing;
      const value = createDemoCase(now());
      await cases.create(value);
      const event = appendEvent([], {
        caseId: value.id,
        type: 'CASE_CREATED',
        occurredAt: now(),
        data: { mode: 'live' },
      });
      await audits.save(value.id, [event]);
      return value;
    },

    async getCase(caseId: string): Promise<VerificationCase> {
      return requireCase(caseId);
    },

    async extract(caseId: string): Promise<VerificationCase> {
      return service.extract(caseId, await liveFiles());
    },

    async recordReview(caseId: string, verification: HumanVerification): Promise<VerificationCase> {
      return service.recordReview(caseId, verification);
    },

    async prepareRelease(caseId: string): Promise<VerificationCase> {
      const value = await requireCase(caseId);
      const evidenceDocuments = (await liveFiles()).map(({ filename, bytes }) => ({ filename, bytes }));
      return service.prepareRelease(caseId, {
        releaseHtml: releaseHtml(value),
        evidenceDocuments,
        outputPath: join(dataDir, 'releases', 'payment-release-authorization.pdf'),
        outputFilename: 'payment-release-authorization.pdf',
      });
    },

    async sign(caseId: string): Promise<VerificationCase> {
      const value = await requireCase(caseId);
      if (!value.releaseDocument) {
        throw new CaseServiceError('SIGNATURE_BLOCKED', 'Release document is not prepared.', 409);
      }
      const bytes = new Uint8Array(await readFile(join(dataDir, 'releases', value.releaseDocument.filename)));
      const baseUrl = (options.config.webOrigin ?? options.config.publicBaseUrl).replace(/\/+$/, '');
      return service.sign(caseId, {
        folderName: 'VeriRemit payment release PO-4821',
        filename: value.releaseDocument.filename,
        bytes,
        signer: { firstName: 'Demo', lastName: 'Controller', email: credentials.signerEmail },
        signSuccessUrl: `${baseUrl}/signing/success`,
        signDeclineUrl: `${baseUrl}/signing/declined`,
      });
    },

    async refreshSignature(caseId: string): Promise<VerificationCase> {
      return service.refreshSignature(caseId);
    },

    async verifyAudit(caseId: string): Promise<{ valid: boolean; corruptIndex?: number }> {
      const result = verifyLedger(await audits.get(caseId));
      return result.valid ? { valid: true } : { valid: false, corruptIndex: result.corruptIndex };
    },

    async createViewerSession(documentId: string) {
      const value = await requireCase(DEMO_CASE_ID);
      const document = value.documents.find((candidate) => candidate.id === documentId);
      if (!document) throw new CaseServiceError('DOCUMENT_NOT_FOUND', 'Evidence document was not found.', 404);

      let providerDocumentId = viewerDocumentIds.get(document.id);
      if (!providerDocumentId) {
        const uploaded = await providers.viewer.ensureDocument({
          filename: document.filename,
          bytes: new Uint8Array(await readFile(join(fixtureDir, document.filename))),
        });
        providerDocumentId = uploaded.documentId;
        viewerDocumentIds.set(document.id, providerDocumentId);
      }
      const session = await providers.viewer.createSession({ documentId: providerDocumentId });
      return {
        mode: 'live' as const,
        token: session.token,
        documentId: providerDocumentId,
        sourceDocumentId: document.id,
        ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}),
      };
    },
  };

  return {
    actions,
    async close() { await providers.close(); },
  };
}
