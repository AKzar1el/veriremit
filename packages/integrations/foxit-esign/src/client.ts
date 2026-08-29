import { createFoxitEsignConfig } from './config.ts';

export type SignatureStatus = 'created' | 'pending' | 'completed' | 'declined' | 'voided';

export interface ReleaseEnvelopeSigner {
  firstName: string;
  lastName: string;
  email: string;
}

export interface ReleaseEnvelopeInput {
  folderName: string;
  filename: string;
  bytes: Uint8Array;
  signer: ReleaseEnvelopeSigner;
  signSuccessUrl: string;
  signDeclineUrl: string;
}

export interface SignatureEnvelope {
  envelopeId: string;
  status: SignatureStatus;
  signingUrl?: string;
}

export interface SignatureState {
  envelopeId: string;
  status: SignatureStatus;
}

export interface SignatureGateway {
  createEnvelope(input: ReleaseEnvelopeInput): Promise<SignatureEnvelope>;
  getStatus(envelopeId: string): Promise<SignatureState>;
}

export class FoxitEsignError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'FoxitEsignError';
    if (options?.status !== undefined) this.status = options.status;
    if (options?.code !== undefined) this.code = options.code;
  }
}

interface FoxitEsignClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function findEmbeddedSessionUrl(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record) {
    if (typeof record.embeddedSessionURL === 'string' && record.embeddedSessionURL.length > 0) {
      return record.embeddedSessionURL;
    }
    for (const child of Object.values(record)) {
      const found = findEmbeddedSessionUrl(child);
      if (found) return found;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findEmbeddedSessionUrl(child);
      if (found) return found;
    }
  }
  return undefined;
}

export function mapFoxitFolderStatus(status: string): SignatureStatus {
  switch (status.trim().toUpperCase()) {
    case 'DRAFT':
      return 'created';
    case 'SHARED':
    case 'PARTIALLY SIGNED':
      return 'pending';
    case 'EXECUTED':
      return 'completed';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'DELETED':
      return 'voided';
    default:
      throw new FoxitEsignError(`Unsupported Foxit eSign status: ${status}.`, { code: 'UNSUPPORTED_STATUS' });
  }
}

async function readJson(response: Response, operation: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new FoxitEsignError(`Foxit eSign ${operation} returned invalid JSON.`, {
      status: response.status,
      code: 'INVALID_JSON',
    });
  }
  const record = asRecord(parsed);
  if (!record) {
    throw new FoxitEsignError(`Foxit eSign ${operation} returned an invalid response.`, {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }
  return record;
}

function getFolder(response: Record<string, unknown>, operation: string): Record<string, unknown> {
  const folder = asRecord(response.folder);
  if (!folder) {
    throw new FoxitEsignError(`Foxit eSign ${operation} response did not include an envelope.`, {
      code: 'MISSING_ENVELOPE',
    });
  }
  return folder;
}

function readEnvelopeId(folder: Record<string, unknown>): string {
  const value = folder.folderId;
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).length === 0) {
    throw new FoxitEsignError('Foxit eSign response did not include an envelope ID.', {
      code: 'MISSING_ENVELOPE_ID',
    });
  }
  return String(value);
}

function readStatus(folder: Record<string, unknown>): SignatureStatus {
  if (typeof folder.folderStatus !== 'string') {
    throw new FoxitEsignError('Foxit eSign response did not include an envelope status.', {
      code: 'MISSING_ENVELOPE_STATUS',
    });
  }
  return mapFoxitFolderStatus(folder.folderStatus);
}

export class FoxitEsignClient implements SignatureGateway {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
  readonly fetchImpl: typeof fetch;
  readonly requestTimeoutMs: number;

  constructor(config: FoxitEsignClientConfig) {
    const normalized = createFoxitEsignConfig(config);
    this.baseUrl = normalized.baseUrl;
    this.headers = normalized.headers;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30_000;
  }

  private async request(path: string, init: RequestInit, operation: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new FoxitEsignError(`Foxit eSign ${operation} request failed.`, { code: 'NETWORK_ERROR' });
    }

    if (!response.ok) {
      throw new FoxitEsignError(
        `Foxit eSign ${operation} request failed with status ${response.status}.`,
        { status: response.status, code: 'HTTP_ERROR' },
      );
    }
    return readJson(response, operation);
  }

  async createEnvelope(input: ReleaseEnvelopeInput): Promise<SignatureEnvelope> {
    const body = {
      folderName: input.folderName,
      inputType: 'base64',
      fileNames: [input.filename],
      base64FileString: [bytesToBase64(input.bytes)],
      processTextTags: false,
      processAcroFields: false,
      parties: [{
        firstName: input.signer.firstName,
        lastName: input.signer.lastName,
        emailId: input.signer.email,
        permission: 'FILL_FIELDS_AND_SIGN',
        sequence: 1,
      }],
      fields: [{
        type: 'signature',
        x: 108,
        y: 720,
        width: 160,
        height: 36,
        documentNumber: 1,
        pageNumber: 1,
        party: 1,
        required: true,
      }],
      createEmbeddedSigningSession: true,
      embeddedSignersEmailIds: [input.signer.email],
      sendNow: true,
      sessionExpire: true,
      expiry: 900000,
      signSuccessUrl: input.signSuccessUrl,
      signDeclineUrl: input.signDeclineUrl,
      signSuccessUrlAllParties: true,
    };

    const response = await this.request(
      '/esign/api/v1/folders/createfolder',
      { method: 'POST', body: JSON.stringify(body) },
      'create envelope',
    );
    const folder = getFolder(response, 'create envelope');
    const envelopeId = readEnvelopeId(folder);
    const status = readStatus(folder);
    const signingUrl = findEmbeddedSessionUrl(response);

    return {
      envelopeId,
      status,
      ...(signingUrl ? { signingUrl } : {}),
    };
  }

  async getStatus(envelopeId: string): Promise<SignatureState> {
    if (!/^\d+$/.test(envelopeId)) {
      throw new FoxitEsignError('Foxit eSign envelope ID must be numeric.', { code: 'INVALID_ENVELOPE_ID' });
    }
    const response = await this.request(
      `/esign/api/v1/folders/myfolder?folderId=${encodeURIComponent(envelopeId)}`,
      { method: 'GET' },
      'get envelope',
    );
    const folder = getFolder(response, 'get envelope');
    return {
      envelopeId: readEnvelopeId(folder),
      status: readStatus(folder),
    };
  }
}
