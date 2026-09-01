import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export interface FoxitMcpToolClient {
  callToolResult(
    toolName: string,
    args: Record<string, unknown> | null,
  ): Promise<unknown>;
}

export interface ReleasePacketEvidenceDocument {
  filename: string;
  bytes: Uint8Array;
}

export interface ReleasePacketPrimaryDocument {
  filename: string;
  bytes: Uint8Array;
}

export interface ReleasePacketInput {
  releaseHtml?: string;
  releaseDocument?: ReleasePacketPrimaryDocument;
  evidenceDocuments: ReleasePacketEvidenceDocument[];
  outputPath: string;
  outputFilename?: string;
}

export interface GeneratedReleaseDocument {
  id: string;
  filename: string;
  provider: 'foxit';
  localPath: string;
}

export interface ReleasePacketGateway {
  prepare(input: ReleasePacketInput): Promise<GeneratedReleaseDocument>;
}

export class FoxitMcpError extends Error {
  readonly toolName: string;
  readonly code?: string;

  constructor(toolName: string, code?: string) {
    super(code ? `Foxit MCP tool ${toolName} failed (${code}).` : `Foxit MCP tool ${toolName} failed.`);
    this.name = 'FoxitMcpError';
    this.toolName = toolName;
    if (code !== undefined) {
      this.code = code;
    }
  }
}

type ToolPayload = Record<string, unknown>;

function asRecord(value: unknown): ToolPayload | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as ToolPayload
    : undefined;
}

function parseTextContent(content: unknown): ToolPayload | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  for (const item of content) {
    const record = asRecord(item);
    if (record?.type !== 'text' || typeof record.text !== 'string') {
      continue;
    }
    try {
      const parsed = JSON.parse(record.text) as unknown;
      const payload = asRecord(parsed);
      if (payload) {
        return payload;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function parseToolPayload(toolName: string, rawResult: unknown): ToolPayload {
  const result = asRecord(rawResult);
  if (!result) {
    throw new FoxitMcpError(toolName, 'INVALID_RESULT');
  }

  const structured = asRecord(result.structuredContent);
  const payload = structured ?? parseTextContent(result.content);
  if (result.isError === true || !payload) {
    throw new FoxitMcpError(toolName, 'INVALID_RESULT');
  }

  if (payload.success !== true) {
    const code = typeof payload.code === 'string' ? payload.code : undefined;
    throw new FoxitMcpError(toolName, code);
  }

  return payload;
}

function requiredString(payload: ToolPayload, key: string, toolName: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new FoxitMcpError(toolName, 'MISSING_RESULT_ID');
  }
  return value;
}

function safeFilename(value: string, fallback: string): string {
  const normalized = basename(value.trim());
  return normalized && normalized !== '.' && normalized !== '..' ? normalized : fallback;
}

export class FoxitReleasePacketGateway implements ReleasePacketGateway {
  readonly client: FoxitMcpToolClient;

  constructor(client: FoxitMcpToolClient) {
    this.client = client;
  }

  private async invoke(toolName: string, args: Record<string, unknown>): Promise<ToolPayload> {
    const result = await this.client.callToolResult(toolName, args);
    return parseToolPayload(toolName, result);
  }

  async prepare(input: ReleasePacketInput): Promise<GeneratedReleaseDocument> {
    if (input.evidenceDocuments.length < 1) {
      throw new Error('At least one evidence document is required to prepare a release packet.');
    }

    const outputFilename = input.outputFilename ?? 'payment-release-authorization.pdf';
    const stagingDir = await mkdtemp(join(tmpdir(), 'veriremit-foxit-'));

    try {
      let releaseDocumentId: string;

      if (input.releaseDocument) {
        const releasePath = join(
          stagingDir,
          safeFilename(input.releaseDocument.filename, 'payment-release-authorization.pdf'),
        );
        await writeFile(releasePath, input.releaseDocument.bytes, { mode: 0o600 });
        const uploadedRelease = await this.invoke('upload_document', { filePath: releasePath });
        releaseDocumentId = requiredString(uploadedRelease, 'documentId', 'upload_document');
      } else if (typeof input.releaseHtml === 'string' && input.releaseHtml.length > 0) {
        const htmlPath = join(stagingDir, 'payment-release-authorization.html');
        await writeFile(htmlPath, input.releaseHtml, { encoding: 'utf8', mode: 0o600 });
        const uploadedHtml = await this.invoke('upload_document', { filePath: htmlPath });
        const htmlDocumentId = requiredString(uploadedHtml, 'documentId', 'upload_document');

        const converted = await this.invoke('pdf_from_html', { documentId: htmlDocumentId });
        releaseDocumentId = requiredString(converted, 'resultDocumentId', 'pdf_from_html');
      } else {
        throw new Error('A release HTML document or generated release PDF is required.');
      }

      const evidenceDocumentIds: string[] = [];
      for (let index = 0; index < input.evidenceDocuments.length; index += 1) {
        const evidence = input.evidenceDocuments[index]!;
        const evidencePath = join(
          stagingDir,
          `${index + 1}-${safeFilename(evidence.filename, `evidence-${index + 1}.pdf`)}`,
        );
        await writeFile(evidencePath, evidence.bytes, { mode: 0o600 });
        const uploadedEvidence = await this.invoke('upload_document', { filePath: evidencePath });
        evidenceDocumentIds.push(requiredString(uploadedEvidence, 'documentId', 'upload_document'));
      }

      const merged = await this.invoke('pdf_merge', {
        documents: [releaseDocumentId, ...evidenceDocumentIds].map((documentId) => ({ documentId })),
      });
      const mergedDocumentId = requiredString(merged, 'resultDocumentId', 'pdf_merge');

      await this.invoke('download_document', {
        documentId: mergedDocumentId,
        outputPath: input.outputPath,
        filename: outputFilename,
      });

      return {
        id: mergedDocumentId,
        filename: outputFilename,
        provider: 'foxit',
        localPath: input.outputPath,
      };
    } finally {
      await rm(stagingDir, { recursive: true, force: true });
    }
  }
}
