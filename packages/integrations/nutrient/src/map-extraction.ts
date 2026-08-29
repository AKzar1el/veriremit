import type { DocumentKind, ExtractedDocument, ExtractedFact } from '@veriremit/domain';

interface NutrientBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NutrientFieldMetadata {
  bbox?: NutrientBounds;
  confidence?: number;
  pageNumber?: number;
}

interface NutrientResponse {
  output: {
    data: Record<string, string | number>;
    metadata?: Record<string, NutrientFieldMetadata>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitiveField(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

function parseBounds(value: unknown): NutrientBounds | undefined {
  if (!isRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (![x, y, width, height].every((part) => typeof part === 'number' && Number.isFinite(part))) {
    return undefined;
  }
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

function parseMetadata(value: unknown): NutrientFieldMetadata {
  if (!isRecord(value)) return {};
  const bbox = parseBounds(value.bbox);
  const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
    ? value.confidence
    : undefined;
  const pageNumber = typeof value.pageNumber === 'number' && Number.isInteger(value.pageNumber)
    ? value.pageNumber
    : undefined;
  return {
    ...(bbox ? { bbox } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(pageNumber !== undefined ? { pageNumber } : {}),
  };
}

function parseResponse(response: unknown): NutrientResponse {
  if (!isRecord(response) || !isRecord(response.output) || !isRecord(response.output.data)) {
    throw new Error('Nutrient extraction response is missing output.data.');
  }

  const data: Record<string, string | number> = {};
  for (const [field, value] of Object.entries(response.output.data)) {
    if (!isPrimitiveField(value)) {
      throw new Error(`Nutrient extraction field ${field} must use a flat primitive schema.`);
    }
    data[field] = value;
  }

  const metadata: Record<string, NutrientFieldMetadata> = {};
  if (isRecord(response.output.metadata)) {
    for (const [field, value] of Object.entries(response.output.metadata)) {
      metadata[field] = parseMetadata(value);
    }
  }

  return { output: { data, metadata } };
}

export function mapNutrientExtraction(input: {
  response: unknown;
  documentId: string;
  filename: string;
  kind: DocumentKind;
}): ExtractedDocument {
  const response = parseResponse(input.response);
  const facts: ExtractedFact<string | number>[] = Object.entries(response.output.data).map(
    ([field, value]) => {
      const metadata = response.output.metadata?.[field];
      const bbox = metadata?.bbox;
      return {
        field,
        value,
        normalizedValue: String(value),
        ...(metadata?.confidence !== undefined ? { confidence: metadata.confidence } : {}),
        source: {
          documentId: input.documentId,
          filename: input.filename,
          ...(metadata?.pageNumber !== undefined ? { page: metadata.pageNumber } : {}),
          ...(bbox ? { boundingBox: [bbox.x, bbox.y, bbox.width, bbox.height] as const } : {}),
        },
      };
    },
  );

  return {
    id: input.documentId,
    kind: input.kind,
    filename: input.filename,
    providerDocumentId: input.documentId,
    facts,
    mode: 'live',
  };
}
