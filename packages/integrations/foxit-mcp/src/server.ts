export const FOXIT_ALLOWED_TOOLS = [
  'upload_document',
  'pdf_from_html',
  'pdf_merge',
  'download_document',
] as const;

const DEFAULT_FOXIT_API_BASE_URL = 'https://na1.fusion.foxit.com/pdf-services';
const DEFAULT_FOXIT_SERVER_ENTRY = 'node_modules/@foxitsoftware/foxit-pdf-api-mcp-server/dist/stdio-server.js';

type FoxitToolName = (typeof FOXIT_ALLOWED_TOOLS)[number];

export interface FoxitMcpServerConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
  nodeExecutable?: string;
  serverEntryPath?: string;
  cwd?: string;
}

export interface FoxitMcpServerSpec {
  transport: 'stdio';
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  allowedTools: FoxitToolName[];
}

interface AgentsMcpSdk {
  MCPServerStdio: { new (options: Record<string, unknown>): unknown };
  createMCPToolStaticFilter(input: { allowed: string[] }): unknown;
}

function currentNodeExecutable(): string {
  const runtime = globalThis as typeof globalThis & {
    process?: { execPath?: string };
  };
  return runtime.process?.execPath ?? 'node';
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function createFoxitMcpServerSpec(config: FoxitMcpServerConfig): FoxitMcpServerSpec {
  return {
    transport: 'stdio',
    command: config.nodeExecutable ?? currentNodeExecutable(),
    args: [config.serverEntryPath ?? DEFAULT_FOXIT_SERVER_ENTRY],
    ...(config.cwd ? { cwd: config.cwd } : {}),
    env: {
      FOXIT_CLOUD_API_BASE_URL: normalizeBaseUrl(config.apiBaseUrl ?? DEFAULT_FOXIT_API_BASE_URL),
      FOXIT_CLOUD_API_CLIENT_ID: config.clientId,
      FOXIT_CLOUD_API_CLIENT_SECRET: config.clientSecret,
    },
    allowedTools: [...FOXIT_ALLOWED_TOOLS],
  };
}

async function loadAgentsSdk(): Promise<AgentsMcpSdk> {
  const packageName = '@openai/agents';
  return import(packageName) as unknown as Promise<AgentsMcpSdk>;
}

export async function createFoxitMcpServer(
  config: FoxitMcpServerConfig,
  sdk?: AgentsMcpSdk,
): Promise<unknown> {
  const activeSdk = sdk ?? await loadAgentsSdk();
  const spec = createFoxitMcpServerSpec(config);
  const toolFilter = activeSdk.createMCPToolStaticFilter({ allowed: [...spec.allowedTools] });

  return new activeSdk.MCPServerStdio({
    command: spec.command,
    args: spec.args,
    ...(spec.cwd ? { cwd: spec.cwd } : {}),
    env: spec.env,
    cacheToolsList: true,
    name: 'foxit-pdf',
    toolFilter,
  });
}
