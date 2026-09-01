import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  FOXIT_ALLOWED_TOOLS,
  createFoxitMcpServer,
} from '../packages/integrations/foxit-mcp/src/index.ts';

function requireCredential(name: 'FOXIT_CLIENT_ID' | 'FOXIT_CLIENT_SECRET'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set FOXIT_CLIENT_ID and FOXIT_CLIENT_SECRET explicitly before running this smoke test.`);
  }
  return value;
}

function readToolPayload(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') {
    throw new Error('Foxit MCP returned an invalid result.');
  }
  const record = result as Record<string, unknown>;
  if (record.structuredContent && typeof record.structuredContent === 'object') {
    return record.structuredContent as Record<string, unknown>;
  }
  if (!Array.isArray(record.content)) {
    throw new Error('Foxit MCP result did not contain text content.');
  }
  for (const item of record.content) {
    if (!item || typeof item !== 'object') continue;
    const content = item as Record<string, unknown>;
    if (content.type !== 'text' || typeof content.text !== 'string') continue;
    const parsed = JSON.parse(content.text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error('Foxit MCP result did not contain a JSON payload.');
}

function requiredResultId(payload: Record<string, unknown>, key: string, toolName: string): string {
  if (payload.success !== true) {
    const code = typeof payload.code === 'string' ? ` (${payload.code})` : '';
    throw new Error(`Foxit ${toolName} failed${code}.`);
  }
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Foxit ${toolName} did not return ${key}.`);
  }
  return value;
}

async function main(): Promise<void> {
  const clientId = requireCredential('FOXIT_CLIENT_ID');
  const clientSecret = requireCredential('FOXIT_CLIENT_SECRET');
  const stagingDir = await mkdtemp(join(tmpdir(), 'veriremit-foxit-smoke-'));
  const inputPath = resolve(stagingDir, 'veriremit-smoke.html');
  const outputPath = resolve(stagingDir, 'veriremit-smoke.pdf');

  const server = await createFoxitMcpServer({
    clientId,
    clientSecret,
    apiBaseUrl: process.env.FOXIT_API_HOST,
    cwd: process.cwd(),
  }) as {
    connect(): Promise<void>;
    close(): Promise<void>;
    listTools(): Promise<Array<{ name: string }>>;
    callToolResult(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  };

  try {
    await server.connect();
    const tools = await server.listTools();
    const names = tools.map((tool) => tool.name);
    for (const expected of FOXIT_ALLOWED_TOOLS) {
      if (!names.includes(expected)) {
        throw new Error(`Foxit MCP is missing expected tool ${expected}.`);
      }
    }
    if (names.some((name) => /sign|esign/i.test(name))) {
      throw new Error('Signing capability unexpectedly appeared in the Foxit MCP allow-list.');
    }

    console.log(`Foxit MCP connected with ${names.length} allow-listed reversible tools.`);

    const html = '<!doctype html><html><body><h1>VeriRemit smoke test</h1><p>Synthetic, non-production document.</p></body></html>';
    await writeFile(inputPath, html, { encoding: 'utf8', mode: 0o600 });
    const uploaded = readToolPayload(await server.callToolResult('upload_document', {
      filePath: inputPath,
    }));
    const htmlDocumentId = requiredResultId(uploaded, 'documentId', 'upload_document');

    const converted = readToolPayload(await server.callToolResult('pdf_from_html', {
      documentId: htmlDocumentId,
    }));
    const pdfDocumentId = requiredResultId(converted, 'resultDocumentId', 'pdf_from_html');

    const downloaded = readToolPayload(await server.callToolResult('download_document', {
      documentId: pdfDocumentId,
      outputPath,
      filename: 'veriremit-smoke.pdf',
    }));
    if (downloaded.success !== true) {
      throw new Error('Foxit download_document failed.');
    }
    const file = await stat(outputPath);
    if (!file.isFile() || file.size < 5) throw new Error('Foxit downloaded file is missing or empty.');
    const prefix = new TextDecoder().decode(new Uint8Array(await readFile(outputPath)).subarray(0, 5));
    if (prefix !== '%PDF-') throw new Error('Foxit downloaded file is not a PDF.');

    console.log('Foxit real HTML-to-PDF conversion succeeded.');
  } finally {
    await server.close().catch(() => undefined);
    await rm(stagingDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Foxit MCP smoke test failed.';
  console.error(message);
  process.exitCode = 2;
});
