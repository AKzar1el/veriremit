import type { RouteRegistrar } from '../http/types.ts';

export function registerHealthRoute(app: RouteRegistrar): void {
  app.get('/health', async () => ({ status: 'ok' }));
}
