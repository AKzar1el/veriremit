const DEFAULT_FOXIT_ESIGN_BASE_URL = 'https://na1.fusion.foxit.com';

export interface FoxitEsignConfigInput {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

export interface FoxitEsignConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

export function createFoxitEsignConfig(input: FoxitEsignConfigInput): FoxitEsignConfig {
  return {
    baseUrl: (input.baseUrl ?? DEFAULT_FOXIT_ESIGN_BASE_URL).replace(/\/+$/, ''),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      client_id: input.clientId,
      client_secret: input.clientSecret,
    },
  };
}
