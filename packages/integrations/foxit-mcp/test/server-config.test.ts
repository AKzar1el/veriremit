import assert from 'node:assert/strict';
import test from 'node:test';

async function loadServer() {
  return import('../src/server.ts').catch(() => ({} as Record<string, unknown>));
}

test('builds a stdio Foxit server specification with only reversible document tools', async () => {
  const module = await loadServer();
  assert.equal(typeof module.createFoxitMcpServerSpec, 'function');

  const spec = (module.createFoxitMcpServerSpec as (input: unknown) => {
    transport: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    allowedTools: string[];
  })({
    clientId: 'foxit-client-id',
    clientSecret: 'foxit-client-secret',
    apiBaseUrl: 'https://example.invalid/pdf-services/',
    nodeExecutable: '/usr/bin/node',
    serverEntryPath: 'node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js',
  });

  assert.equal(spec.transport, 'stdio');
  assert.equal(spec.command, '/usr/bin/node');
  assert.deepEqual(spec.args, ['node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js']);
  assert.deepEqual(spec.env, {
    FOXIT_CLOUD_API_BASE_URL: 'https://example.invalid/pdf-services',
    FOXIT_CLOUD_API_CLIENT_ID: 'foxit-client-id',
    FOXIT_CLOUD_API_CLIENT_SECRET: 'foxit-client-secret',
  });
  assert.deepEqual(spec.allowedTools, [
    'upload_document',
    'pdf_from_html',
    'pdf_merge',
    'download_document',
  ]);
  assert.equal(spec.allowedTools.some((tool) => /sign|esign/i.test(tool)), false);
});

test('creates the OpenAI MCP stdio server with a static allow-list', async () => {
  const module = await loadServer();
  assert.equal(typeof module.createFoxitMcpServer, 'function');

  const observed: { options?: Record<string, unknown>; filter?: unknown } = {};
  class FakeMCPServerStdio {
    readonly options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      observed.options = options;
    }
  }

  const server = await (module.createFoxitMcpServer as (input: unknown, sdk: unknown) => Promise<unknown>)(
    {
      clientId: 'client',
      clientSecret: 'secret',
      nodeExecutable: '/node',
      serverEntryPath: '/project/node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js',
    },
    {
      MCPServerStdio: FakeMCPServerStdio,
      createMCPToolStaticFilter(config: unknown) {
        observed.filter = config;
        return { kind: 'static-filter', config };
      },
    },
  );

  assert.ok(server instanceof FakeMCPServerStdio);
  assert.deepEqual(observed.filter, {
    allowed: ['upload_document', 'pdf_from_html', 'pdf_merge', 'download_document'],
  });
  assert.deepEqual(observed.options?.toolFilter, {
    kind: 'static-filter',
    config: { allowed: ['upload_document', 'pdf_from_html', 'pdf_merge', 'download_document'] },
  });
});
