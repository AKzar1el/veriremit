import { sendHttpError } from '../http/errors.ts';
import type { HttpReply, HttpRequest, RouteRegistrar } from '../http/types.ts';

type CaseParams = { id: string };

export interface SignatureActions {
  sign(caseId: string): Promise<unknown>;
  refreshSignature(caseId: string): Promise<unknown>;
}

export function registerSignatureRoutes(app: RouteRegistrar, actions: SignatureActions): void {
  app.post('/api/cases/:id/sign', async (request: HttpRequest<CaseParams>, reply: HttpReply) => {
    try {
      return await actions.sign(request.params.id);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });

  app.get('/api/cases/:id/signature', async (request: HttpRequest<CaseParams>, reply: HttpReply) => {
    try {
      return await actions.refreshSignature(request.params.id);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
