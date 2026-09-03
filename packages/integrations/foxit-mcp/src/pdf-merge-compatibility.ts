const DEFAULT_BASE_URL = 'https://na1.fusion.foxit.com/pdf-services';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

export interface FoxitPdfServicesMergeClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

type JsonRecord = Record<string, unknown>;

export class FoxitPdfServicesError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, options: { code: string; status?: number }) {
    super(message);
    this.name = 'FoxitPdfServicesError';
    this.code = options.code;
    if (options.status !== undefined) this.status = options.status;
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class FoxitPdfServicesMergeClient {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
  readonly fetchImpl: typeof fetch;
  readonly requestTimeoutMs: number;
  readonly pollTimeoutMs: number;
  readonly pollIntervalMs: number;
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(config: FoxitPdfServicesMergeClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.headers = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.now = config.now ?? Date.now;
    this.sleep = config.sleep ?? defaultSleep;
  }

  private async request(
    path: string,
    init: RequestInit,
    operation: string,
    timeoutMs = this.requestTimeoutMs,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new FoxitPdfServicesError(`Foxit PDF Services ${operation} request failed.`, {
        code: 'NETWORK_ERROR',
      });
    }
  }

  private async readJson(response: Response, operation: string): Promise<JsonRecord> {
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new FoxitPdfServicesError(`Foxit PDF Services ${operation} returned invalid JSON.`, {
        code: 'INVALID_JSON',
        status: response.status,
      });
    }
    const record = asRecord(value);
    if (!record) {
      throw new FoxitPdfServicesError(`Foxit PDF Services ${operation} returned an invalid response.`, {
        code: 'INVALID_RESPONSE',
        status: response.status,
      });
    }
    return record;
  }

  private timeoutError(): FoxitPdfServicesError {
    return new FoxitPdfServicesError('Foxit PDF Services merge task timed out.', {
      code: 'TASK_TIMEOUT',
    });
  }

  async merge(documentInfos: ReadonlyArray<{ documentId: string }>): Promise<string> {
    const submitted = await this.request(
      '/api/documents/enhance/pdf-combine',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentInfos }),
      },
      'merge submission',
    );
    if (submitted.status !== 202) {
      throw new FoxitPdfServicesError(
        `Foxit PDF Services merge submission failed with status ${submitted.status}.`,
        { code: 'HTTP_ERROR', status: submitted.status },
      );
    }
    const submission = await this.readJson(submitted, 'merge submission');
    const taskId = nonEmptyString(submission.taskId);
    if (!taskId) {
      throw new FoxitPdfServicesError(
        'Foxit PDF Services merge submission did not include a task ID.',
        { code: 'MISSING_TASK_ID' },
      );
    }

    const startedAt = this.now();
    while (true) {
      const remainingBeforeRequest = this.pollTimeoutMs - (this.now() - startedAt);
      if (remainingBeforeRequest <= 0) throw this.timeoutError();

      const response = await this.request(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        { method: 'GET' },
        'merge status',
        Math.min(this.requestTimeoutMs, remainingBeforeRequest),
      );
      if (this.now() - startedAt >= this.pollTimeoutMs) throw this.timeoutError();
      if (!response.ok) {
        throw new FoxitPdfServicesError(
          `Foxit PDF Services merge status failed with status ${response.status}.`,
          { code: 'HTTP_ERROR', status: response.status },
        );
      }
      const task = await this.readJson(response, 'merge status');
      if (task.status === 'COMPLETED') {
        const resultDocumentId = nonEmptyString(task.resultDocumentId);
        if (!resultDocumentId) {
          throw new FoxitPdfServicesError(
            'Foxit PDF Services merge task did not include a result document ID.',
            { code: 'MISSING_RESULT_ID' },
          );
        }
        return resultDocumentId;
      }
      if (task.status === 'FAILED') {
        throw new FoxitPdfServicesError('Foxit PDF Services merge task failed.', {
          code: 'TASK_FAILED',
        });
      }
      if (task.status !== 'PENDING' && task.status !== 'PROCESSING') {
        throw new FoxitPdfServicesError(
          'Foxit PDF Services merge task returned an invalid status.',
          { code: 'INVALID_TASK_STATUS' },
        );
      }
      const remainingBeforeSleep = this.pollTimeoutMs - (this.now() - startedAt);
      if (remainingBeforeSleep <= 0) throw this.timeoutError();
      await this.sleep(Math.min(this.pollIntervalMs, remainingBeforeSleep));
    }
  }
}
