import type { DocumentKind, ExtractedDocument } from '@veriremit/domain';
import { mapNutrientExtraction } from './map-extraction.ts';

export interface DocumentExtractor {
  extract(input: {
    filename: string;
    bytes: Uint8Array;
    kind: DocumentKind;
  }): Promise<ExtractedDocument>;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type JsonSchema = Readonly<Record<string, unknown>>;

const EXTRACT_URL = 'https://api.nutrient.io/extraction/extract';

const STRING_FIELD = { type: 'string' } as const;
const NUMBER_FIELD = { type: 'number' } as const;

const SCHEMAS: Record<DocumentKind, JsonSchema> = {
  vendor_master: {
    type: 'object',
    additionalProperties: false,
    properties: {
      vendor_id: STRING_FIELD,
      vat_id: STRING_FIELD,
      beneficiary_name: STRING_FIELD,
      iban: STRING_FIELD,
      trusted_phone: STRING_FIELD,
    },
    required: ['vendor_id', 'vat_id', 'beneficiary_name', 'iban', 'trusted_phone'],
  },
  purchase_order: {
    type: 'object',
    additionalProperties: false,
    properties: {
      po_number: STRING_FIELD,
      vendor_id: STRING_FIELD,
      currency: STRING_FIELD,
      amount: NUMBER_FIELD,
    },
    required: ['po_number', 'vendor_id', 'currency', 'amount'],
  },
  previous_invoice: {
    type: 'object',
    additionalProperties: false,
    properties: {
      vendor_id: STRING_FIELD,
      vat_id: STRING_FIELD,
      beneficiary_name: STRING_FIELD,
      iban: STRING_FIELD,
    },
    required: ['vendor_id', 'vat_id', 'beneficiary_name', 'iban'],
  },
  current_invoice: {
    type: 'object',
    additionalProperties: false,
    properties: {
      vendor_id: STRING_FIELD,
      vat_id: STRING_FIELD,
      po_number: STRING_FIELD,
      currency: STRING_FIELD,
      amount: NUMBER_FIELD,
      beneficiary_name: STRING_FIELD,
      iban: STRING_FIELD,
    },
    required: ['vendor_id', 'vat_id', 'po_number', 'currency', 'amount', 'beneficiary_name', 'iban'],
  },
  bank_change_letter: {
    type: 'object',
    additionalProperties: false,
    properties: {
      vendor_id: STRING_FIELD,
      iban: STRING_FIELD,
    },
    required: ['vendor_id', 'iban'],
  },
};

export class NutrientProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NutrientProviderError';
    this.status = status;
  }
}

export interface NutrientExtractionClientConfig {
  apiKey: string;
  fetchImpl?: FetchLike;
  endpoint?: string;
  requestTimeoutMs?: number;
}

function internalDocumentId(kind: DocumentKind, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return `doc_${kind}_${safe}`;
}

export class NutrientExtractionClient implements DocumentExtractor {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;
  private readonly requestTimeoutMs: number;

  constructor(config: NutrientExtractionClientConfig) {
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = config.endpoint ?? EXTRACT_URL;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30_000;
  }

  async extract(input: {
    filename: string;
    bytes: Uint8Array;
    kind: DocumentKind;
  }): Promise<ExtractedDocument> {
    const form = new FormData();
    form.append('file', new Blob([input.bytes], { type: 'application/pdf' }), input.filename);
    form.append('schema', JSON.stringify(SCHEMAS[input.kind]));

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new NutrientProviderError('Nutrient extract request failed.');
    }

    if (!response.ok) {
      throw new NutrientProviderError(
        `Nutrient extract request failed with status ${response.status}.`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new NutrientProviderError('Nutrient extract response was not valid JSON.', response.status);
    }

    try {
      return mapNutrientExtraction({
        response: payload,
        documentId: internalDocumentId(input.kind, input.filename),
        filename: input.filename,
        kind: input.kind,
      });
    } catch {
      throw new NutrientProviderError('Nutrient extract response had an unexpected shape.', response.status);
    }
  }
}
