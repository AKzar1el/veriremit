import type { RouteRegistrar } from './http/types.ts';
import { registerAgentRoutes } from './routes/agent.ts';
import type { AgentActions } from './routes/agent.ts';
import { registerCaseRoutes } from './routes/cases.ts';
import type { CaseActions } from './routes/cases.ts';
import { registerHealthRoute } from './routes/health.ts';
import { registerSignatureRoutes } from './routes/signature.ts';
import type { SignatureActions } from './routes/signature.ts';
import { registerViewerRoutes } from './routes/viewer.ts';
import type { ViewerActions } from './routes/viewer.ts';

export interface ApplicationActions extends CaseActions, SignatureActions, ViewerActions, AgentActions {}

interface FastifyServer extends RouteRegistrar {
  listen(options: { port: number; host: string }): Promise<string>;
  close(): Promise<void>;
  register?(plugin: unknown, options?: unknown): unknown;
}

export type FastifyFactory = (options?: { logger?: boolean | Record<string, unknown> }) => FastifyServer;

export interface BuildAppOptions {
  actions: ApplicationActions;
  logger?: boolean | Record<string, unknown>;
  fastifyFactory?: FastifyFactory;
  corsOrigin?: string;
  corsPlugin?: unknown;
}

async function loadCorsPlugin(): Promise<unknown> {
  const specifier = '@fastify/cors';
  const module = await import(specifier) as { default?: unknown };
  return module.default ?? module;
}

async function loadFastifyFactory(): Promise<FastifyFactory> {
  const specifier = 'fastify';
  const module = await import(specifier) as unknown as { default?: FastifyFactory } & FastifyFactory;
  const factory = typeof module.default === 'function' ? module.default : module;
  if (typeof factory !== 'function') {
    throw new Error('Fastify factory could not be loaded.');
  }
  return factory as FastifyFactory;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyServer> {
  const factory = options.fastifyFactory ?? await loadFastifyFactory();
  const app = factory({ logger: options.logger ?? true });
  if (options.corsOrigin) {
    if (!app.register) throw new Error('Fastify CORS registration is unavailable.');
    const plugin = options.corsPlugin ?? await loadCorsPlugin();
    await app.register(plugin, {
      origin: options.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: false,
    });
  }
  registerHealthRoute(app);
  registerCaseRoutes(app, options.actions);
  registerSignatureRoutes(app, options.actions);
  registerViewerRoutes(app, options.actions);
  registerAgentRoutes(app, options.actions);
  return app;
}
