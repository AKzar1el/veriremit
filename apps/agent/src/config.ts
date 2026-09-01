export type ProviderMode = 'fixture' | 'live';

export interface AgentConfig {
  host: string;
  port: number;
  dataDir: string;
  providerMode: ProviderMode;
  logger: boolean;
  nutrientApiKey?: string;
  nutrientViewerApiKey?: string;
  foxitClientId?: string;
  foxitClientSecret?: string;
  foxitApiHost?: string;
  foxitEsignHost?: string;
  groqApiKey?: string;
  doctavianApiKey?: string;
  doctavianAccessToken?: string;
  doctavianApiBaseUrl?: string;
  signerEmail?: string;
  publicBaseUrl: string;
  webOrigin?: string;
}

function optional(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value === undefined || value.length === 0 ? undefined : value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) return 8787;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  return port;
}

function parseProviderMode(value: string | undefined): ProviderMode {
  if (value === undefined || value === 'fixture') return 'fixture';
  if (value === 'live') return 'live';
  throw new Error('Provider mode must be fixture or live (VERIREMIT_PROVIDER_MODE).');
}

export function loadAgentConfig(
  env: Record<string, string | undefined> = process.env,
): AgentConfig {
  const config: AgentConfig = {
    host: env.HOST ?? '0.0.0.0',
    port: parsePort(env.PORT),
    dataDir: env.VERIREMIT_DATA_DIR ?? '.data',
    providerMode: parseProviderMode(env.VERIREMIT_PROVIDER_MODE),
    logger: env.VERIREMIT_LOGGER !== 'false',
    publicBaseUrl: env.VERIREMIT_PUBLIC_BASE_URL ?? 'http://localhost:8787',
  };

  const nutrientApiKey = optional(env, 'NUTRIENT_API_KEY');
  const nutrientViewerApiKey = optional(env, 'NUTRIENT_DWS_VIEWER_API_KEY');
  const foxitClientId = optional(env, 'FOXIT_CLIENT_ID');
  const foxitClientSecret = optional(env, 'FOXIT_CLIENT_SECRET');
  const foxitApiHost = optional(env, 'FOXIT_API_HOST');
  const foxitEsignHost = optional(env, 'FOXIT_ESIGN_HOST');
  const groqApiKey = optional(env, 'GROQ_API_KEY');
  const doctavianApiKey = optional(env, 'DOCTAVIAN_API_KEY');
  const doctavianAccessToken = optional(env, 'DOCTAVIAN_ACCESS_TOKEN');
  const doctavianApiBaseUrl = optional(env, 'DOCTAVIAN_API_BASE_URL');
  const signerEmail = optional(env, 'VERIREMIT_SIGNER_EMAIL');
  const webOrigin = optional(env, 'VERIREMIT_WEB_ORIGIN');

  if (nutrientApiKey) config.nutrientApiKey = nutrientApiKey;
  if (nutrientViewerApiKey) config.nutrientViewerApiKey = nutrientViewerApiKey;
  if (foxitClientId) config.foxitClientId = foxitClientId;
  if (foxitClientSecret) config.foxitClientSecret = foxitClientSecret;
  if (foxitApiHost) config.foxitApiHost = foxitApiHost;
  if (foxitEsignHost) config.foxitEsignHost = foxitEsignHost;
  if (groqApiKey) config.groqApiKey = groqApiKey;
  if (doctavianApiKey) config.doctavianApiKey = doctavianApiKey;
  if (doctavianAccessToken) config.doctavianAccessToken = doctavianAccessToken;
  if (doctavianApiBaseUrl) config.doctavianApiBaseUrl = doctavianApiBaseUrl;
  if (signerEmail) config.signerEmail = signerEmail;
  if (webOrigin) config.webOrigin = webOrigin;

  return config;
}
