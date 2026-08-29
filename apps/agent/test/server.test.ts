import assert from 'node:assert/strict';
import test from 'node:test';

test('startServer listens on configured host and port using the composed app', async () => {
  const module = await import('../src/server.ts').catch(() => ({} as Record<string, unknown>));
  assert.equal(typeof module.startServer, 'function');

  const calls: Array<{ port: number; host: string }> = [];
  const fakeServer = {
    get() {},
    post() {},
    async listen(options: { port: number; host: string }) {
      calls.push(options);
      return `http://${options.host}:${options.port}`;
    },
    async close() {},
  };
  const noop = async () => ({});
  const actions = {
    createDemoCase: noop,
    getCase: noop,
    extract: noop,
    recordReview: noop,
    prepareRelease: noop,
    verifyAudit: noop,
    sign: noop,
    refreshSignature: noop,
    createViewerSession: noop,
  };

  const result = await (module.startServer as (options: unknown) => Promise<any>)({
    actions,
    config: { host: '127.0.0.1', port: 9090, logger: false },
    fastifyFactory: () => fakeServer,
  });

  assert.deepEqual(calls, [{ host: '127.0.0.1', port: 9090 }]);
  assert.equal(result.app, fakeServer);
  assert.equal(result.address, 'http://127.0.0.1:9090');
});
