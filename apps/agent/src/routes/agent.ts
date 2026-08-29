import { sendHttpError } from '../http/errors.ts';
import type { HttpReply, HttpRequest, RouteRegistrar } from '../http/types.ts';
import { CaseServiceError } from '../services/case-service.ts';

type CaseParams = { id: string };
type AgentBody = { prompt?: unknown };

export interface AgentActions {
  runAgent(caseId: string, prompt: string): Promise<unknown>;
}

function requirePrompt(body: AgentBody | undefined): string {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length === 0 || prompt.length > 1200) {
    throw new CaseServiceError(
      'INVALID_AGENT_PROMPT',
      'Agent prompt must contain 1 to 1200 characters.',
      400,
    );
  }
  return prompt;
}

export function registerAgentRoutes(app: RouteRegistrar, actions: AgentActions): void {
  app.post('/api/cases/:id/agent', async (
    request: HttpRequest<CaseParams, AgentBody>,
    reply: HttpReply,
  ) => {
    try {
      const prompt = requirePrompt(request.body);
      return { output: await actions.runAgent(request.params.id, prompt) };
    } catch (error) {
      return sendHttpError(reply, error);
    }
  });
}
