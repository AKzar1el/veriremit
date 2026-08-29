import { startRuntimeServer } from './bootstrap.ts';
import { loadAgentConfig } from './config.ts';

const { address, close } = await startRuntimeServer({ config: loadAgentConfig() });
console.log(`VeriRemit agent listening at ${address}`);

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down VeriRemit agent.`);
  await close();
  process.exit(0);
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
