import type { DocumentKind, ExtractedDocument } from '@veriremit/domain';
import type { DocumentExtractor } from './client.ts';

export const FIXTURE_MODE_LABEL = 'DEMO FIXTURE MODE';

export class FixtureDocumentExtractor implements DocumentExtractor {
  private readonly documents: readonly ExtractedDocument[];

  constructor(documents: readonly ExtractedDocument[]) {
    this.documents = documents;
  }

  async extract(input: {
    filename: string;
    bytes: Uint8Array;
    kind: DocumentKind;
  }): Promise<ExtractedDocument> {
    void input.bytes;
    const document = this.documents.find(
      (candidate) => candidate.kind === input.kind && candidate.filename === input.filename,
    );
    if (!document) {
      throw new Error(`No synthetic extraction fixture for ${input.kind}:${input.filename}.`);
    }
    return { ...document, mode: 'fixture' };
  }
}
