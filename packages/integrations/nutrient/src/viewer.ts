import { NutrientProviderError } from './client.ts';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DOCUMENTS_URL = 'https://api.nutrient.io/viewer/documents';
const SESSIONS_URL = 'https://api.nutrient.io/viewer/sessions';
const SESSION_TTL_SECONDS = 15 * 60;

export interface ViewerGateway {
  ensureDocument(input: { filename: string; bytes: Uint8Array }): Promise<{ documentId: string }>;
  createSession(input: { documentId: string }): Promise<{ token: string; expiresAt?: string }>;
}

export interface NutrientViewerGatewayConfig {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
  documentsUrl?: string;
  sessionsUrl?: string;
  requestTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class NutrientViewerGateway implements ViewerGateway {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly documentsUrl: string;
  private readonly sessionsUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(config: NutrientViewerGatewayConfig) {
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => new Date());
    this.documentsUrl = config.documentsUrl ?? DOCUMENTS_URL;
    this.sessionsUrl = config.sessionsUrl ?? SESSIONS_URL;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30_000;
  }

  async ensureDocument(input: { filename: string; bytes: Uint8Array }): Promise<{ documentId: string }> {
    void input.filename;
    const body = new Uint8Array(input.bytes).buffer;
    let response: Response;
    try {
      response = await this.fetchImpl(this.documentsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/pdf',
          'Content-Length': String(input.bytes.byteLength),
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new NutrientProviderError('Nutrient Viewer document upload failed.');
    }

    if (!response.ok) {
      throw new NutrientProviderError(
        `Nutrient Viewer document upload failed with status ${response.status}.`,
        response.status,
      );
    }

    const payload: unknown = await response.json().catch(() => null);
    const documentId = isRecord(payload) && isRecord(payload.data) && typeof payload.data.document_id === 'string'
      ? payload.data.document_id
      : undefined;
    if (!documentId) {
      throw new NutrientProviderError('Nutrient Viewer upload response did not include a document id.', response.status);
    }
    return { documentId };
  }

  async createSession(input: { documentId: string }): Promise<{ token: string; expiresAt?: string }> {
    const now = this.now();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000);
    const payload = {
      allowed_documents: [
        {
          document_id: input.documentId,
          document_permissions: ['read'],
        },
      ],
      exp,
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.sessionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new NutrientProviderError('Nutrient Viewer session creation failed.');
    }

    if (!response.ok) {
      throw new NutrientProviderError(
        `Nutrient Viewer session creation failed with status ${response.status}.`,
        response.status,
      );
    }

    const result: unknown = await response.json().catch(() => null);
    const token = isRecord(result) && typeof result.jwt === 'string' ? result.jwt : undefined;
    if (!token) {
      throw new NutrientProviderError('Nutrient Viewer session response did not include a token.', response.status);
    }

    return { token, expiresAt: expiresAt.toISOString() };
  }
}
