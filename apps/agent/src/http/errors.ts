import { CaseServiceError } from '../services/case-service.ts';
import type { HttpReply } from './types.ts';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: readonly string[];
  };
}

export function toErrorEnvelope(error: unknown): { statusCode: number; body: ErrorEnvelope } {
  if (error instanceof CaseServiceError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }
  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
      },
    },
  };
}

export function sendHttpError(reply: HttpReply, error: unknown): unknown {
  const mapped = toErrorEnvelope(error);
  return reply.code(mapped.statusCode).send(mapped.body);
}
