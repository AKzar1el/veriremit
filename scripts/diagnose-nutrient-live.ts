import { readFile } from 'node:fs/promises';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function redact(text: string, secret: string): string {
  return text
    .replaceAll(secret, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(?:sk-proj-|gsk_|pdf_live_)[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 1200);
}

function shape(value: unknown, depth = 0): unknown {
  if (depth > 4) return typeof value;
  if (Array.isArray(value)) return { type: 'array', length: value.length, item: value.length ? shape(value[0], depth + 1) : undefined };
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = shape(item, depth + 1);
    }
    return result;
  }
  return typeof value;
}

async function attempt(
  label: string,
  apiKey: string,
  bytes: Uint8Array,
  mode: 'instructions' | 'schema',
): Promise<boolean> {
  const schema = {
    type: 'object',
    properties: {
      beneficiary_name: { type: 'string' },
    },
  };
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'vendor-master.pdf');
  if (mode === 'instructions') {
    form.append('instructions', JSON.stringify({ schema }));
  } else {
    form.append('schema', JSON.stringify(schema));
  }

  const response = await fetch('https://api.nutrient.io/extraction/extract', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  console.log(`${label}: HTTP ${response.status}`);
  if (!response.ok) {
    console.log(`${label} sanitized response: ${redact(text, apiKey)}`);
    return false;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    console.log(`${label} response shape: ${JSON.stringify(shape(parsed))}`);
  } catch {
    console.log(`${label} response is non-JSON (${text.length} bytes).`);
  }
  return true;
}

async function main(): Promise<void> {
  const apiKey = required('NUTRIENT_API_KEY');
  const bytes = new Uint8Array(await readFile('fixtures/acme-components/vendor-master.pdf'));
  const instructions = await attempt('instructions/minimal-schema', apiKey, bytes, 'instructions');
  const schema = await attempt('direct-schema/minimal-schema', apiKey, bytes, 'schema');
  if (!instructions && !schema) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Nutrient live diagnostic failed.');
  process.exitCode = 2;
});
