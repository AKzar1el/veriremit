import assert from 'node:assert/strict';
import test from 'node:test';
import { CaseServiceError } from '../src/services/case-service.ts';

interface CapturedRoute {
  method: 'GET' | 'POST';
  path: string;
  handler: (request: any, reply: any) => Promise<unknown> | unknown;
}

function fakeApp() {
  const routes: CapturedRoute[] = [];
  return {
    routes,
    get(path: string, handler: CapturedRoute['handler']) {
      routes.push({ method: 'GET', path, handler });
    },
    post(path: string, handler: CapturedRoute['handler']) {
      routes.push({ method: 'POST', path, handler });
    },
  };
}

function fakeReply() {
  let statusCode = 200;
  let payload: unknown;
  const reply = {
    code(next: number) {
      statusCode = next;
      return reply;
    },
    send(next: unknown) {
      payload = next;
      return next;
    },
    snapshot() {
      return { statusCode, payload };
    },
  };
  return reply;
}

async function loadRoutes() {
  const [health, cases, signature, viewer] = await Promise.all([
    import('../src/routes/health.ts').catch(() => ({} as Record<string, unknown>)),
    import('../src/routes/cases.ts').catch(() => ({} as Record<string, unknown>)),
    import('../src/routes/signature.ts').catch(() => ({} as Record<string, unknown>)),
    import('../src/routes/viewer.ts').catch(() => ({} as Record<string, unknown>)),
  ]);
  return { health, cases, signature, viewer };
}

test('prepare-release route returns stable 409 envelope when deterministic gate denies', async () => {
  const { cases } = await loadRoutes();
  assert.equal(typeof cases.registerCaseRoutes, 'function');
  const app = fakeApp();
  const actions = {
    async createDemoCase() { throw new Error('unused'); },
    async getCase() { throw new Error('unused'); },
    async extract() { throw new Error('unused'); },
    async recordReview() { throw new Error('unused'); },
    async prepareRelease() {
      throw new CaseServiceError('RELEASE_BLOCKED', 'Human verification required.', 409, ['bank_account_continuity']);
    },
    async verifyAudit() { throw new Error('unused'); },
  };
  (cases.registerCaseRoutes as (app: unknown, actions: unknown) => void)(app, actions);
  const route = app.routes.find((candidate) =>
    candidate.method === 'POST' && candidate.path === '/api/cases/:id/prepare-release'
  );
  assert.ok(route);
  const reply = fakeReply();
  await route.handler({ params: { id: 'case_acme_po_4821' } }, reply);
  assert.deepEqual(reply.snapshot(), {
    statusCode: 409,
    payload: {
      error: {
        code: 'RELEASE_BLOCKED',
        message: 'Human verification required.',
        details: ['bank_account_continuity'],
      },
    },
  });
});

test('sign route returns stable 409 envelope before release preparation', async () => {
  const { signature } = await loadRoutes();
  assert.equal(typeof signature.registerSignatureRoutes, 'function');
  const app = fakeApp();
  const actions = {
    async sign() {
      throw new CaseServiceError('SIGNATURE_BLOCKED', 'Release document required.', 409);
    },
    async refreshSignature() { throw new Error('unused'); },
  };
  (signature.registerSignatureRoutes as (app: unknown, actions: unknown) => void)(app, actions);
  const route = app.routes.find((candidate) =>
    candidate.method === 'POST' && candidate.path === '/api/cases/:id/sign'
  );
  assert.ok(route);
  const reply = fakeReply();
  await route.handler({ params: { id: 'case_acme_po_4821' } }, reply);
  assert.deepEqual(reply.snapshot(), {
    statusCode: 409,
    payload: {
      error: {
        code: 'SIGNATURE_BLOCKED',
        message: 'Release document required.',
      },
    },
  });
});

test('route modules register the complete minimum polling API without accepting provider payloads', async () => {
  const { health, cases, signature, viewer } = await loadRoutes();
  const app = fakeApp();
  const noop = async () => ({ ok: true });
  (health.registerHealthRoute as (app: unknown) => void)(app);
  (cases.registerCaseRoutes as (app: unknown, actions: unknown) => void)(app, {
    createDemoCase: noop,
    getCase: noop,
    extract: noop,
    recordReview: noop,
    prepareRelease: noop,
    verifyAudit: noop,
  });
  (signature.registerSignatureRoutes as (app: unknown, actions: unknown) => void)(app, {
    sign: noop,
    refreshSignature: noop,
  });
  (viewer.registerViewerRoutes as (app: unknown, actions: unknown) => void)(app, {
    createViewerSession: noop,
  });

  const registered = app.routes.map(({ method, path }) => `${method} ${path}`).sort();
  assert.deepEqual(registered, [
    'GET /api/cases/:id',
    'GET /api/cases/:id/audit/verify',
    'GET /api/cases/:id/signature',
    'GET /health',
    'POST /api/cases/:id/extract',
    'POST /api/cases/:id/prepare-release',
    'POST /api/cases/:id/review',
    'POST /api/cases/:id/sign',
    'POST /api/cases/demo',
    'POST /api/documents/:id/viewer-session',
  ].sort());

  const release = app.routes.find((candidate) => candidate.path.endsWith('/prepare-release'));
  const sign = app.routes.find((candidate) => candidate.path.endsWith('/sign'));
  assert.ok(release && sign);
  assert.equal(release.handler.length, 2);
  assert.equal(sign.handler.length, 2);
});

test('buildApp composes route modules without requiring provider-specific request bodies', async () => {
  const module = await import('../src/app.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.buildApp, 'function');
  const app = fakeApp();
  const actions = {
    async createDemoCase() { return {}; },
    async getCase() { return {}; },
    async extract() { return {}; },
    async recordReview() { return {}; },
    async prepareRelease() { return {}; },
    async verifyAudit() { return { valid: true }; },
    async sign() { return {}; },
    async refreshSignature() { return {}; },
    async createViewerSession() { return {}; },
    async runAgent() { return 'ok'; },
  };

  const built = await (module.buildApp as (options: unknown) => Promise<unknown>)({
    actions,
    fastifyFactory: () => app,
    logger: false,
  });
  assert.equal(built, app);
  assert.equal(app.routes.some((route) => route.path === '/health'), true);
  assert.equal(app.routes.some((route) => route.path === '/api/cases/:id/sign'), true);
  assert.equal(app.routes.some((route) => route.path === '/api/cases/:id/agent'), true);
});

test('buildApp registers CORS for exactly one configured frontend origin', async () => {
  const module = await import('../src/app.ts').catch(() => ({} as Record<string, unknown>));
  const app = fakeApp() as ReturnType<typeof fakeApp> & {
    register(plugin: unknown, options: unknown): unknown;
  };
  const registrations: Array<{ plugin: unknown; options: unknown }> = [];
  app.register = (plugin, options) => {
    registrations.push({ plugin, options });
    return app;
  };
  const corsPlugin = Symbol('cors');
  const actions = {
    async createDemoCase() { return {}; },
    async getCase() { return {}; },
    async extract() { return {}; },
    async recordReview() { return {}; },
    async prepareRelease() { return {}; },
    async verifyAudit() { return { valid: true }; },
    async sign() { return {}; },
    async refreshSignature() { return {}; },
    async createViewerSession() { return {}; },
    async runAgent() { return 'ok'; },
  };

  await (module.buildApp as (options: any) => Promise<unknown>)({
    actions,
    fastifyFactory: () => app,
    logger: false,
    corsOrigin: 'https://veriremit.example',
    corsPlugin,
  });

  assert.deepEqual(registrations, [{
    plugin: corsPlugin,
    options: {
      origin: 'https://veriremit.example',
      methods: ['GET', 'POST'],
      credentials: false,
    },
  }]);
});
