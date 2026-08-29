import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { appendEvent, verifyLedger } from '@veriremit/audit';
import type { HumanVerification, VerificationCase } from '@veriremit/domain';
import { FixtureDocumentExtractor } from '../../../packages/integrations/nutrient/src/fixture-extractor.ts';
import { createDemoCase, DEMO_CASE_ID } from './demo/create-demo-case.ts';
import { FilesystemAuditRepository } from './repository/filesystem-audit-repository.ts';
import { FilesystemCaseRepository } from './repository/filesystem-case-repository.ts';
import { CaseService, CaseServiceError } from './services/case-service.ts';

export interface FixtureRuntimeOptions {
  dataDir: string;
  fixtureDir?: string;
  now?: () => string;
}

interface FixtureFile {
  filename: string;
  kind: VerificationCase['documents'][number]['kind'];
}

const PDF_HEADER = '%PDF-1.4\n';
const DEFAULT_FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/acme-components/', import.meta.url));

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function fixtureReleasePdf(): Uint8Array {
  const lines = [
    'VERIREMIT - DEMO - FICTIONAL DATA',
    'Payment Release Authorization - PO-4821',
    'Supplier: ACME Components GmbH',
    'Amount: 48,620.00 EUR',
    'Bank change independently verified by trusted callback.',
    'Fixture mode only - no payment has been or can be executed.',
  ];
  const stream = lines.map((line, index) => (
    `BT /F1 ${index === 0 ? 13 : 11} Tf 54 ${760 - index * 34} Td (${escapePdfText(line)}) Tj ET`
  )).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];
  let body = PDF_HEADER;
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

export async function createFixtureRuntimeActions(options: FixtureRuntimeOptions) {
  const now = options.now ?? (() => new Date().toISOString());
  const fixtureDir = options.fixtureDir ? resolve(options.fixtureDir) : DEFAULT_FIXTURE_DIR;
  const dataDir = resolve(options.dataDir);
  const cases = new FilesystemCaseRepository(join(dataDir, 'cases'));
  const audits = new FilesystemAuditRepository(join(dataDir, 'audit'));
  const fixtureRaw = JSON.parse(await readFile(join(fixtureDir, 'fixture-extraction.json'), 'utf8')) as {
    documents: VerificationCase['documents'];
  };
  const extractor = new FixtureDocumentExtractor(fixtureRaw.documents);

  const releaseGateway = {
    async prepare(input: { outputPath: string; outputFilename?: string }) {
      await mkdir(resolve(input.outputPath, '..'), { recursive: true });
      await writeFile(input.outputPath, fixtureReleasePdf(), { mode: 0o600 });
      return {
        id: 'fixture-foxit-release-po-4821',
        filename: input.outputFilename ?? 'payment-release-authorization.pdf',
        provider: 'foxit' as const,
        localPath: input.outputPath,
      };
    },
  };

  const signatureGateway = {
    async createEnvelope() {
      return { envelopeId: 'fixture-envelope-po-4821', status: 'pending' as const };
    },
    async getStatus(envelopeId: string) {
      return { envelopeId, status: 'completed' as const };
    },
  };

  const service = new CaseService({
    cases,
    audits,
    extractor,
    releaseGateway,
    signatureGateway,
    now,
  });

  async function requireCase(caseId: string): Promise<VerificationCase> {
    const value = await cases.get(caseId);
    if (!value) throw new CaseServiceError('CASE_NOT_FOUND', 'Verification case was not found.', 404);
    return value;
  }

  async function fixtureFiles(): Promise<Array<FixtureFile & { bytes: Uint8Array }>> {
    return Promise.all(fixtureRaw.documents.map(async (document) => ({
      filename: document.filename,
      kind: document.kind,
      bytes: new Uint8Array(await readFile(join(fixtureDir, document.filename))),
    })));
  }

  return {
    async createDemoCase(): Promise<VerificationCase> {
      const existing = await cases.get(DEMO_CASE_ID);
      if (existing) return existing;
      const value = createDemoCase(now());
      await cases.create(value);
      const event = appendEvent([], {
        caseId: value.id,
        type: 'CASE_CREATED',
        occurredAt: now(),
        data: { mode: 'fixture' },
      });
      await audits.save(value.id, [event]);
      return value;
    },

    async getCase(caseId: string): Promise<VerificationCase> {
      return requireCase(caseId);
    },

    async extract(caseId: string): Promise<VerificationCase> {
      return service.extract(caseId, await fixtureFiles());
    },

    async recordReview(caseId: string, verification: HumanVerification): Promise<VerificationCase> {
      return service.recordReview(caseId, verification);
    },

    async prepareRelease(caseId: string): Promise<VerificationCase> {
      const evidenceDocuments = (await fixtureFiles()).map(({ filename, bytes }) => ({ filename, bytes }));
      return service.prepareRelease(caseId, {
        releaseHtml: [
          '<h1>Payment Release Authorization - PO-4821</h1>',
          '<p>Supplier: ACME Components GmbH</p>',
          '<p>Amount: 48,620.00 EUR</p>',
          '<p>Human verification recorded before release preparation.</p>',
        ].join(''),
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
      return service.sign(caseId, {
        folderName: 'VeriRemit fixture payment release PO-4821',
        filename: value.releaseDocument.filename,
        bytes,
        signer: { firstName: 'Demo', lastName: 'Controller', email: 'fixture@example.invalid' },
        signSuccessUrl: 'https://example.invalid/veriremit/signed',
        signDeclineUrl: 'https://example.invalid/veriremit/declined',
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
      if (!value.documents.some((document) => document.id === documentId)) {
        throw new CaseServiceError('DOCUMENT_NOT_FOUND', 'Evidence document was not found.', 404);
      }
      return {
        mode: 'fixture' as const,
        token: `fixture-session:${documentId}`,
        documentId,
        expiresAt: new Date(Date.parse(now()) + 15 * 60 * 1000).toISOString(),
      };
    },
  };
}
