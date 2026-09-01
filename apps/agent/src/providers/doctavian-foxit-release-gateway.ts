import type {
  DoctavianGeneratedDocument,
  DoctavianGenerationInput,
} from './doctavian-client.ts';
import { createDoctavianReleaseTemplate } from './doctavian-template.ts';

interface DoctavianGenerator {
  generate(input: DoctavianGenerationInput): Promise<DoctavianGeneratedDocument>;
}

interface FoxitGeneratedReleaseDocument {
  id: string;
  filename: string;
  provider: 'foxit';
  localPath: string;
}

interface FoxitPacketGateway {
  prepare(input: {
    releaseDocument: { filename: string; bytes: Uint8Array };
    evidenceDocuments: Array<{ filename: string; bytes: Uint8Array }>;
    outputPath: string;
    outputFilename?: string;
  }): Promise<FoxitGeneratedReleaseDocument>;
}

export interface StructuredReleasePacketInput {
  releaseHtml?: string;
  releaseData?: Readonly<Record<string, unknown>>;
  evidenceDocuments: Array<{ filename: string; bytes: Uint8Array }>;
  outputPath: string;
  outputFilename?: string;
}

export interface CompositeGeneratedReleaseDocument extends FoxitGeneratedReleaseDocument {
  generation: {
    id: string;
    filename: string;
    provider: 'doctavian';
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function releaseCaseId(data: Readonly<Record<string, unknown>>): string {
  const release = data.Release;
  if (!isRecord(release) || typeof release.CaseId !== 'string' || release.CaseId.trim().length === 0) {
    throw new Error('Structured release data must include Release.CaseId.');
  }
  return release.CaseId.trim();
}

export class DoctavianFoxitReleaseGateway {
  private readonly doctavian: DoctavianGenerator;
  private readonly foxit: FoxitPacketGateway;

  constructor(dependencies: { doctavian: DoctavianGenerator; foxit: FoxitPacketGateway }) {
    this.doctavian = dependencies.doctavian;
    this.foxit = dependencies.foxit;
  }

  async prepare(input: StructuredReleasePacketInput): Promise<CompositeGeneratedReleaseDocument> {
    if (!input.releaseData) {
      throw new Error('Structured release data is required for Doctavian generation.');
    }
    const caseId = releaseCaseId(input.releaseData);
    const generated = await this.doctavian.generate({
      templateFilename: 'veriremit-release-template.docx',
      templateBytes: createDoctavianReleaseTemplate(),
      dataFilename: 'veriremit-release-data.json',
      data: input.releaseData,
      outputFilename: 'doctavian-payment-release-authorization.pdf',
      externalContextId: `veriremit-${caseId}`,
    });

    const assembled = await this.foxit.prepare({
      releaseDocument: {
        filename: generated.filename,
        bytes: generated.bytes,
      },
      evidenceDocuments: input.evidenceDocuments,
      outputPath: input.outputPath,
      ...(input.outputFilename ? { outputFilename: input.outputFilename } : {}),
    });

    return {
      ...assembled,
      generation: {
        id: generated.id,
        filename: generated.filename,
        provider: 'doctavian',
      },
    };
  }
}
