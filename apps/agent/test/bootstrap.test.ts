import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function loadBootstrap() {
  return import('../src/bootstrap.ts').catch(() => ({} as Record<string, unknown>));
}

test('fixture bootstrap wires the concrete runtime actions into the HTTP server without live providers', async () => {
  const module = await loadBootstrap();
  assert.equal(typeof module.startRuntimeServer, 'function');
  const dataDir = await mkdtemp(join(tmpdir(), 'veriremit-bootstrap-'));
  const routes: Array<{ method: string; path: string; handler?: (...args: any[]) => unknown }> = [];
  let listenOptions: unknown;
  let runnerDependencies: Record<string, unknown> | null = null;

  const fakeFastifyFactory = () => ({
    get(path: string, handler?: (...args: any[]) => unknown) { routes.push({ method: 'GET', path, handler }); },
    post(path: string, handler?: (...args: any[]) => unknown) { routes.push({ method: 'POST', path, handler }); },
    async listen(options: unknown) { listenOptions = options; return 'http://127.0.0.1:8787'; },
    async close() {},
  });

  try {
    const result = await (module.startRuntimeServer as (options: any) => Promise<any>)({
      config: {
        host: '127.0.0.1',
        port: 8787,
        dataDir,
        providerMode: 'fixture',
        logger: false,
        publicBaseUrl: 'http://127.0.0.1:8787',
      },
      fastifyFactory: fakeFastifyFactory,
      caseAgentRunnerFactory: (dependencies: Record<string, unknown>) => {
        runnerDependencies = dependencies;
        return async (caseId: string, prompt: string) => ({ caseId, prompt });
      },
    });

    assert.equal(result.address, 'http://127.0.0.1:8787');
    assert.deepEqual(listenOptions, { host: '127.0.0.1', port: 8787 });
    assert.ok(routes.some((route) => route.method === 'POST' && route.path === '/api/cases/demo'));
    assert.ok(routes.some((route) => route.method === 'POST' && route.path === '/api/cases/:id/extract'));
    assert.ok(routes.some((route) => route.method === 'POST' && route.path === '/api/cases/:id/prepare-release'));
    assert.ok(routes.some((route) => route.method === 'POST' && route.path === '/api/cases/:id/sign'));
    assert.ok(routes.some((route) => route.method === 'GET' && route.path === '/api/cases/:id/signature'));
    assert.ok(routes.some((route) => route.method === 'POST' && route.path === '/api/documents/:id/viewer-session'));
    const agentRoute = routes.find((route) => route.method === 'POST' && route.path === '/api/cases/:id/agent');
    assert.ok(agentRoute?.handler);
    assert.deepEqual(Object.keys(runnerDependencies ?? {}).sort(), [
      'extractCase',
      'getCase',
      'prepareRelease',
      'requestHumanSignature',
    ]);
    assert.deepEqual(
      await agentRoute.handler(
        { params: { id: 'case_acme_po_4821' }, body: { prompt: 'Review this packet.' } },
        {},
      ),
      { output: { caseId: 'case_acme_po_4821', prompt: 'Review this packet.' } },
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('live bootstrap uses the live runtime factory and closes provider resources after the server', async () => {
  const module = await loadBootstrap();
  const routes: string[] = [];
  const closeOrder: string[] = [];
  const fakeFastifyFactory = () => ({
    get(path: string) { routes.push(`GET ${path}`); },
    post(path: string) { routes.push(`POST ${path}`); },
    async listen() { return 'http://127.0.0.1:8787'; },
    async close() { closeOrder.push('server'); },
  });
  const noopCase = async () => ({ id: 'case_acme_po_4821' });
  const actions = {
    createDemoCase: noopCase,
    getCase: noopCase,
    extract: noopCase,
    recordReview: noopCase,
    prepareRelease: noopCase,
    verifyAudit: async () => ({ valid: true }),
    sign: noopCase,
    refreshSignature: noopCase,
    createViewerSession: async () => ({ token: 'test' }),
  };

  const result = await (module.startRuntimeServer as (options: any) => Promise<any>)({
    config: {
      host: '127.0.0.1',
      port: 8787,
      dataDir: '.data',
      providerMode: 'live',
      logger: false,
      publicBaseUrl: 'https://demo.example',
      nutrientApiKey: 'nutrient-test',
      nutrientViewerApiKey: 'viewer-test',
      foxitClientId: 'foxit-client-test',
      foxitClientSecret: 'foxit-secret-test',
      signerEmail: 'controller@example.com',
    },
    fastifyFactory: fakeFastifyFactory,
    liveRuntimeFactory: async () => ({
      actions,
      async close() { closeOrder.push('providers'); },
    }),
  });

  assert.ok(routes.includes('POST /api/cases/:id/prepare-release'));
  await result.close();
  assert.deepEqual(closeOrder, ['server', 'providers']);
});
