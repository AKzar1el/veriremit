import type { HumanVerification, SourceRef, VerificationCase } from '@veriremit/domain';
import { resolveApiUrl } from './api-url.ts';

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: readonly string[];
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly string[];

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? `Request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.error?.code ?? 'HTTP_ERROR';
    this.details = payload.error?.details ?? [];
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(resolveApiUrl(path, viteEnv?.VITE_API_BASE_URL), {
    ...init,
    headers,
  });
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = await response.json() as ApiErrorPayload;
    } catch {
      // Keep the stable generic envelope; never surface provider response text.
    }
    throw new ApiError(response.status, payload);
  }
  return response.json() as Promise<T>;
}

export async function getCase(caseId: string): Promise<VerificationCase> {
  return request(`/api/cases/${encodeURIComponent(caseId)}`);
}

export async function loadOrCreateDemoCase(): Promise<VerificationCase> {
  try {
    return await getCase('case_acme_po_4821');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    return request('/api/cases/demo', { method: 'POST' });
  }
}

export async function runExtraction(caseId: string): Promise<VerificationCase> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/extract`, { method: 'POST' });
}

export async function runCaseAgent(caseId: string, prompt: string): Promise<{ output: unknown }> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/agent`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export async function recordTrustedCallback(input: {
  caseId: string;
  trustedContactSource: SourceRef;
  reference: string;
  reviewerName: string;
  result: HumanVerification['result'];
}): Promise<VerificationCase> {
  const body: HumanVerification = {
    method: 'trusted_callback',
    trustedContactSource: input.trustedContactSource,
    reference: input.reference,
    reviewerName: input.reviewerName,
    result: input.result,
    recordedAt: new Date().toISOString(),
  };
  return request(`/api/cases/${encodeURIComponent(input.caseId)}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function prepareRelease(caseId: string): Promise<VerificationCase> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/prepare-release`, { method: 'POST' });
}

export async function sendForSignature(caseId: string): Promise<VerificationCase> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/sign`, { method: 'POST' });
}

export async function refreshSignature(caseId: string): Promise<VerificationCase> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/signature`);
}

export async function verifyAudit(caseId: string): Promise<{ valid: boolean; corruptIndex?: number }> {
  return request(`/api/cases/${encodeURIComponent(caseId)}/audit/verify`);
}

export async function createViewerSession(documentId: string): Promise<{
  token: string;
  documentId?: string;
  expiresAt?: string;
}> {
  return request(`/api/documents/${encodeURIComponent(documentId)}/viewer-session`, { method: 'POST' });
}
