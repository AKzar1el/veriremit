import {
  createReviewerToolDefinitions,
  type ReviewerToolDependencies,
} from './tools.ts';

export const REVIEWER_MODEL = 'gpt-5-nano' as const;

export interface ReviewerAgentConfig {
  name: string;
  model: typeof REVIEWER_MODEL;
  instructions: string;
  modelSettings: {
    maxTokens: number;
    reasoning: { effort: 'minimal' };
    text: { verbosity: 'low' };
    parallelToolCalls: false;
    store: false;
    toolChoice: 'auto';
  };
}

export function createReviewerAgentConfig(): ReviewerAgentConfig {
  return {
    name: 'VeriRemit Reviewer',
    model: REVIEWER_MODEL,
    instructions: [
      'You explain and orchestrate a vendor-payment verification case.',
      'Never decide PASS or FAIL yourself; deterministic server rules are authoritative.',
      'Never invent evidence, verification, approval, document generation, or signature state.',
      'Use get_case_summary before describing case state when state may have changed.',
      'Use extract_case when the user asks to review a newly created document packet; deterministic server rules decide the outcome.',
      'Use prepare_release only when the user asks to proceed after human verification; the server gate is authoritative and denials must be reported as denials.',
      'After prepare_release succeeds, use request_human_signature only when the user asked to send the prepared document for signature. It creates a Foxit eSign envelope through the direct API, but a human must perform the actual signature.',
      'You cannot sign, approve a bank change, or authorize payment. Treat the authoritative server state as final.',
      'Keep responses concise and operational.',
    ].join(' '),
    modelSettings: {
      maxTokens: 256,
      reasoning: { effort: 'minimal' },
      text: { verbosity: 'low' },
      parallelToolCalls: false,
      store: false,
      toolChoice: 'auto',
    },
  };
}

interface AgentsSdk {
  Agent: new (config: Record<string, unknown>) => unknown;
  tool(options: Record<string, unknown>): unknown;
}

export interface CreateReviewerAgentDependencies extends ReviewerToolDependencies {
  mcpServers?: readonly unknown[];
  sdk?: AgentsSdk;
}

async function loadAgentsSdk(): Promise<AgentsSdk> {
  const packageName = '@openai/agents';
  return import(packageName) as unknown as Promise<AgentsSdk>;
}

export async function createReviewerAgent(
  dependencies: CreateReviewerAgentDependencies,
): Promise<unknown> {
  const sdk = dependencies.sdk ?? await loadAgentsSdk();
  const config = createReviewerAgentConfig();
  const tools = createReviewerToolDefinitions(dependencies).map((definition) =>
    sdk.tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      strict: true,
      timeoutMs: 15_000,
      execute: definition.invoke,
    })
  );

  return new sdk.Agent({
    ...config,
    tools,
    ...(dependencies.mcpServers && dependencies.mcpServers.length > 0
      ? { mcpServers: [...dependencies.mcpServers] }
      : {}),
  });
}

export interface RunReviewerAgentInput {
  agent: unknown;
  input: string;
  run?: (
    agent: unknown,
    input: string,
    options: { maxTurns: number },
  ) => Promise<{ finalOutput?: unknown }>;
}

async function loadRunFunction(): Promise<RunReviewerAgentInput['run']> {
  const packageName = '@openai/agents';
  const sdk = await import(packageName) as unknown as {
    run: NonNullable<RunReviewerAgentInput['run']>;
  };
  return sdk.run;
}

export async function runReviewerAgent(input: RunReviewerAgentInput): Promise<unknown> {
  const run = input.run ?? await loadRunFunction();
  if (!run) throw new Error('OpenAI Agents SDK run function is unavailable.');
  const result = await run(input.agent, input.input, { maxTurns: 3 });
  return result.finalOutput;
}
