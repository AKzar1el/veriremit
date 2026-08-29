import { buildApp } from './app.ts';
import type { ApplicationActions, FastifyFactory } from './app.ts';

export interface ServerConfig {
  host: string;
  port: number;
  logger: boolean | Record<string, unknown>;
  corsOrigin?: string;
}

export interface StartServerOptions {
  actions: ApplicationActions;
  config: ServerConfig;
  fastifyFactory?: FastifyFactory;
}

export async function startServer(options: StartServerOptions) {
  const app = await buildApp({
    actions: options.actions,
    logger: options.config.logger,
    ...(options.fastifyFactory ? { fastifyFactory: options.fastifyFactory } : {}),
    ...(options.config.corsOrigin ? { corsOrigin: options.config.corsOrigin } : {}),
  });
  const address = await app.listen({
    host: options.config.host,
    port: options.config.port,
  });
  return { app, address };
}
