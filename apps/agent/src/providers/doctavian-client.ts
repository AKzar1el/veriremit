type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE_URL = 'https://demo.api.doctavian.com';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface DoctavianGenerationInput {
  templateFilename: string;
  templateBytes: Uint8Array;
  dataFilename: string;
  data: Readonly<Record<string, unknown>>;
  outputFilename: string;
  externalContextId: string;
  locale?: string;
  timezone?: string;
}

export interface DoctavianGeneratedDocument {
  id: string;
  filename: string;
  provider: 'doctavian';
  bytes: Uint8Array;
}

export interface DoctavianGenerationClientConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  requestTimeoutMs?: number;
}

export class DoctavianProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'DoctavianProviderError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function outputName(filename: string): string {
  const trimmed = filename.trim();
  const withoutExtension = trimmed.replace(/\.pdf$/i, '');
  return withoutExtension || 'payment-release-authorization';
}

function requiredUploadedId(payload: unknown, operation: string, status: number): string {
  if (!isRecord(payload) || !isRecord(payload.result) || !isRecord(payload.result.data)
    || !Array.isArray(payload.result.data.files)) {
    throw new DoctavianProviderError(`Doctavian ${operation} response had an unexpected shape.`, status);
  }
  const first = payload.result.data.files[0];
  if (!isRecord(first) || typeof first.id !== 'string' || first.id.length === 0) {
    throw new DoctavianProviderError(`Doctavian ${operation} response did not include a file id.`, status);
  }
  return first.id;
}

function requiredGeneratedUrn(payload: unknown, status: number): string {
  if (!isRecord(payload) || !isRecord(payload.result) || !isRecord(payload.result.data)
    || !isRecord(payload.result.data.document)
    || typeof payload.result.data.document.urn !== 'string'
    || payload.result.data.document.urn.length === 0) {
    throw new DoctavianProviderError('Doctavian generation response did not include a document URN.', status);
  }
  return payload.result.data.document.urn;
}

export class DoctavianGenerationClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly requestTimeoutMs: number;

  constructor(config: DoctavianGenerationClientConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) throw new Error('Doctavian API key is required.');
    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request(
    operation: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'X-Api-Key': this.apiKey,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new DoctavianProviderError(`Doctavian ${operation} request failed.`);
    }
    if (!response.ok) {
      throw new DoctavianProviderError(
        `Doctavian ${operation} failed with status ${response.status}.`,
        response.status,
      );
    }
    return response;
  }

  private async uploadFile(
    operation: 'template upload' | 'data upload',
    path: string,
    filename: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), filename);
    const response = await this.request(operation, path, { method: 'POST', body: form });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DoctavianProviderError(`Doctavian ${operation} response was not valid JSON.`, response.status);
    }
    return requiredUploadedId(payload, operation, response.status);
  }

  async generate(input: DoctavianGenerationInput): Promise<DoctavianGeneratedDocument> {
    const templateId = await this.uploadFile(
      'template upload',
      '/v1/documents/template/upload',
      input.templateFilename,
      input.templateBytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const dataBytes = new TextEncoder().encode(JSON.stringify(input.data));
    const dataId = await this.uploadFile(
      'data upload',
      '/v1/documents/data/upload',
      input.dataFilename,
      dataBytes,
      'application/json',
    );

    const generateResponse = await this.request(
      'generation',
      '/v1/documents/document/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalContext: { id: input.externalContextId },
          template: {
            name: input.templateFilename,
            urn: templateId,
            fileFormat: 'docx',
            loadMethod: 'Storage',
            options: {},
          },
          data: {
            loadMethod: 'Storage',
            urn: dataId,
          },
          document: {
            name: outputName(input.outputFilename),
            fileFormat: 'pdf',
            deliveryMethod: 'Storage',
            path: 'root',
            locale: input.locale ?? 'en',
            timezone: input.timezone ?? 'Europe/Ljubljana',
            options: {},
          },
        }),
      },
    );

    let generatePayload: unknown;
    try {
      generatePayload = await generateResponse.json();
    } catch {
      throw new DoctavianProviderError(
        'Doctavian generation response was not valid JSON.',
        generateResponse.status,
      );
    }
    const documentUrn = requiredGeneratedUrn(generatePayload, generateResponse.status);

    const downloadResponse = await this.request(
      'document download',
      `/v1/documents/document/${encodeURIComponent(documentUrn)}/download`,
      { method: 'GET' },
    );
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await downloadResponse.arrayBuffer());
    } catch {
      throw new DoctavianProviderError(
        'Doctavian document download could not be read.',
        downloadResponse.status,
      );
    }
    if (bytes.length === 0) {
      throw new DoctavianProviderError('Doctavian document download was empty.', downloadResponse.status);
    }

    return {
      id: documentUrn,
      filename: input.outputFilename,
      provider: 'doctavian',
      bytes,
    };
  }
}
