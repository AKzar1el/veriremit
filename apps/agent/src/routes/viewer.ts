import { sendHttpError } from '../http/errors.ts';
import type { HttpReply, HttpRequest, RouteRegistrar } from '../http/types.ts';

type DocumentParams = { id: string };

export interface ViewerActions {
  createViewerSession(documentId: string): Promise<unknown>;
}

export function registerViewerRoutes(app: RouteRegistrar, actions: ViewerActions): void {
  app.post('/api/documents/:id/viewer-session', async (
    request: HttpRequest<DocumentParams>,
    reply: HttpReply,
  ) => {
    try {
      return await actions.createViewerSession(request.params.id);
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
