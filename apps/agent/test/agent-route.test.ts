import assert from 'node:assert/strict';
import test from 'node:test';

interface CapturedRoute {
  path: string;
  handler: (request: any, reply: any) => Promise<unknown> | unknown;
}

function reply() {
  let statusCode = 200;
  let payload: unknown;
  const value = {
    code(code: number) { statusCode = code; return value; },
    send(next: unknown) { payload = next; return next; },
    snapshot() { return { statusCode, payload }; },
  };
  return value;
}

test('agent route accepts one bounded plain prompt and delegates only the route case id', async () => {
  const module = await import('../src/routes/agent.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.registerAgentRoutes, 'function');
  const routes: CapturedRoute[] = [];
  const app = {
    post(path: string, handler: CapturedRoute['handler']) { routes.push({ path, handler }); },
  };
  let received: unknown;
  (module.registerAgentRoutes as (app: unknown, actions: unknown) => void)(app, {
    async runAgent(caseId: string, prompt: string) {
      received = { caseId, prompt };
      return 'Blocked pending trusted callback.';
    },
  });
  const route = routes.find((candidate) => candidate.path === '/api/cases/:id/agent');
  assert.ok(route);
  const output = await route.handler({
    params: { id: 'case_acme_po_4821' },
    body: { prompt: ' Review this packet and prepare it only if safe. ' },
  }, reply());
  assert.deepEqual(received, {
    caseId: 'case_acme_po_4821',
    prompt: 'Review this packet and prepare it only if safe.',
  });
  assert.deepEqual(output, { output: 'Blocked pending trusted callback.' });
});

test('agent route rejects empty or oversized prompts before any model call', async () => {
  const module = await import('../src/routes/agent.ts').catch(() => ({} as Record<string, unknown>));
  const routes: CapturedRoute[] = [];
  const app = { post(path: string, handler: CapturedRoute['handler']) { routes.push({ path, handler }); } };
  let calls = 0;
  (module.registerAgentRoutes as (app: unknown, actions: unknown) => void)(app, {
    async runAgent() { calls += 1; return 'unused'; },
  });
  const route = routes[0];
  assert.ok(route);

  const emptyReply = reply();
  await route.handler({ params: { id: 'case_acme_po_4821' }, body: { prompt: '   ' } }, emptyReply);
  assert.equal(emptyReply.snapshot().statusCode, 400);

  const longReply = reply();
  await route.handler({ params: { id: 'case_acme_po_4821' }, body: { prompt: 'x'.repeat(1201) } }, longReply);
  assert.equal(longReply.snapshot().statusCode, 400);
  assert.equal(calls, 0);
});
