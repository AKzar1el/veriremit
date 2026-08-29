import type { HumanVerification } from '@veriremit/domain';
import { sendHttpError } from '../http/errors.ts';
import type { HttpReply, HttpRequest, RouteRegistrar } from '../http/types.ts';

export interface CaseActions {
  createDemoCase(): Promise<unknown>;
  getCase(caseId: string): Promise<unknown>;
  extract(caseId: string): Promise<unknown>;
  recordReview(caseId: string, verification: HumanVerification): Promise<unknown>;
  prepareRelease(caseId: string): Promise<unknown>;
  verifyAudit(caseId: string): Promise<unknown>;
}

type CaseParams = { id: string };

function idOf(request: HttpRequest<CaseParams>): string {
  return request.params.id;
}

export function registerCaseRoutes(app: RouteRegistrar, actions: CaseActions): void {
  app.post('/api/cases/demo', async (_request, reply) => {
    try {
      return await actions.createDemoCase();
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.get('/api/cases/:id', async (request: HttpRequest<CaseParams>, reply: HttpReply) => {
    try {
      return await actions.getCase(idOf(request));
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.post('/api/cases/:id/extract', async (request: HttpRequest<CaseParams>, reply: HttpReply) => {
    try {
      return await actions.extract(idOf(request));
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.post('/api/cases/:id/review', async (
    request: HttpRequest<CaseParams, HumanVerification>,
    reply: HttpReply,
  ) => {
    try {
      return await actions.recordReview(idOf(request), request.body);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.post('/api/cases/:id/prepare-release', async (
    request: HttpRequest<CaseParams>,
    reply: HttpReply,
  ) => {
    try {
      return await actions.prepareRelease(idOf(request));
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.get('/api/cases/:id/audit/verify', async (
    request: HttpRequest<CaseParams>,
    reply: HttpReply,
  ) => {
    try {
      return await actions.verifyAudit(idOf(request));
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
