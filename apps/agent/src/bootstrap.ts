import type { ApplicationActions, FastifyFactory } from './app.ts';
import { createCaseAgentRunner } from './agent/case-agent-runner.ts';
import type { AgentConfig } from './config.ts';
import { createLiveRuntimeActions } from './live-runtime-actions.ts';
import { createFixtureRuntimeActions } from './runtime-actions.ts';
import { startServer } from './server.ts';

type FixtureRuntimeActions = Awaited<ReturnType<typeof createFixtureRuntimeActions>>;
type LiveRuntimeActions = Awaited<ReturnType<typeof createLiveRuntimeActions>>['actions'];
type RuntimeActions = FixtureRuntimeActions | LiveRuntimeActions;

interface ClosableRuntime {
  actions: RuntimeActions;
  close(): Promise<void>;
}

type LiveRuntimeFactory = (options: { config: AgentConfig }) => Promise<ClosableRuntime>;
type CaseAgentRunnerFactory = (dependencies: {
  getCase: RuntimeActions['getCase'];
  extractCase(caseId: string): ReturnType<RuntimeActions['extract']>;
  prepareRelease: RuntimeActions['prepareRelease'];
  requestHumanSignature: RuntimeActions['sign'];
}) => ApplicationActions['runAgent'];

export interface StartRuntimeServerOptions {
  config: AgentConfig;
  fastifyFactory?: FastifyFactory;
  liveRuntimeFactory?: LiveRuntimeFactory;
  caseAgentRunnerFactory?: CaseAgentRunnerFactory;
}

export async function startRuntimeServer(options: StartRuntimeServerOptions) {
  let runtimeActions: RuntimeActions;
  let closeProviders = async () => {};

  if (options.config.providerMode === 'live') {
    const runtimeFactory = options.liveRuntimeFactory ?? createLiveRuntimeActions;
    const runtime = await runtimeFactory({ config: options.config });
    runtimeActions = runtime.actions;
    closeProviders = runtime.close;
  } else {
    runtimeActions = await createFixtureRuntimeActions({
      dataDir: options.config.dataDir,
    });
  }

  const caseAgentRunnerFactory = options.caseAgentRunnerFactory ?? createCaseAgentRunner;
  const actions: ApplicationActions = {
    ...runtimeActions,
    runAgent: caseAgentRunnerFactory({
      getCase: runtimeActions.getCase,
      extractCase: runtimeActions.extract,
      prepareRelease: runtimeActions.prepareRelease,
      requestHumanSignature: runtimeActions.sign,
    }),
  };

  let started: Awaited<ReturnType<typeof startServer>>;
  try {
    started = await startServer({
      actions,
      config: {
        host: options.config.host,
        port: options.config.port,
        logger: options.config.logger,
        ...(options.config.webOrigin ? { corsOrigin: options.config.webOrigin } : {}),
      },
      ...(options.fastifyFactory ? { fastifyFactory: options.fastifyFactory } : {}),
    });
  } catch (error) {
    await closeProviders().catch(() => undefined);
    throw error;
  }

  let closed = false;
  return {
    ...started,
    async close() {
      if (closed) return;
      closed = true;
      try {
        await started.app.close();
      } finally {
        await closeProviders();
      }
    },
  };
}
