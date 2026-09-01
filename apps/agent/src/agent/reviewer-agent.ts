import {
  createReviewerToolDefinitions,
  type ReviewerToolDependencies,
} from './tools.ts';

export const REVIEWER_MODEL = 'gpt-5-nano' as const;
export const GROQ_REVIEWER_MODEL = 'openai/gpt-oss-120b' as const;
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1' as const;

const REVIEWER_INSTRUCTIONS = [
  'You explain and orchestrate a vendor-payment verification case.',
  'Never decide PASS or FAIL yourself; deterministic server rules are authoritative.',
  'Never invent evidence, verification, approval, document generation, or signature state.',
  'Use get_case_summary before describing case state when state may have changed.',
  'Use extract_case when the user asks to review a newly created document packet; deterministic server rules decide the outcome.',
  'Use prepare_release only when the user asks to proceed after human verification; the server gate is authoritative and denials must be reported as denials.',
  'After prepare_release succeeds, use request_human_signature only when the user asked to send the prepared document for signature. It creates a Foxit eSign envelope through the direct API, but a human must perform the actual signature.',
  'You cannot sign, approve a bank change, or authorize payment. Treat the authoritative server state as final.',
  'Keep responses concise and operational.',
].join(' ');

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

interface GroqReviewerAgentConfig {
  name: string;
  model: typeof GROQ_REVIEWER_MODEL;
  instructions: string;
  modelSettings: {
    maxTokens: number;
    parallelToolCalls: false;
    toolChoice: 'auto';
  };
}

export function createReviewerAgentConfig(): ReviewerAgentConfig {
  return {
    name: 'VeriRemit Reviewer',
    model: REVIEWER_MODEL,
    instructions: REVIEWER_INSTRUCTIONS,
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

function createGroqReviewerAgentConfig(): GroqReviewerAgentConfig {
  return {
    name: 'VeriRemit Reviewer',
    model: GROQ_REVIEWER_MODEL,
    instructions: REVIEWER_INSTRUCTIONS,
    modelSettings: {
      maxTokens: 256,
      parallelToolCalls: false,
      toolChoice: 'auto',
    },
  };
}

interface OpenAICompatibleProvider {
  getModel(model: string): unknown | Promise<unknown>;
}

interface AgentsSdk {
  Agent: new (config: Record<string, unknown>) => unknown;
  OpenAIProvider: new (options: {
    apiKey: string;
    baseURL: string;
    useResponses: boolean;
    strictFeatureValidation: boolean;
  }) => OpenAICompatibleProvider;
  tool(options: Record<string, unknown>): unknown;
}

export interface CreateReviewerAgentDependencies extends ReviewerToolDependencies {
  mcpServers?: readonly unknown[];
  sdk?: AgentsSdk;
  env?: Record<string, string | undefined>;
}

async function loadAgentsSdk(): Promise<AgentsSdk> {
  const packageName = '@openai/agents';
  return import(packageName) as unknown as Promise<AgentsSdk>;
}

function optionalSecret(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export async function createReviewerAgent(
  dependencies: CreateReviewerAgentDependencies,
): Promise<unknown> {
  const sdk = dependencies.sdk ?? await loadAgentsSdk();
  const env = dependencies.env ?? process.env;
  const groqApiKey = optionalSecret(env, 'GROQ_API_KEY');
  let config: ReviewerAgentConfig | GroqReviewerAgentConfig;
  let model: unknown;

  if (groqApiKey) {
    config = createGroqReviewerAgentConfig();
    const provider = new sdk.OpenAIProvider({
      apiKey: groqApiKey,
      baseURL: GROQ_BASE_URL,
      useResponses: false,
      strictFeatureValidation: true,
    });
    model = await provider.getModel(GROQ_REVIEWER_MODEL);
  } else {
    config = createReviewerAgentConfig();
    model = config.model;
  }

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
    model,
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
    options: { maxTurns: number; tracingDisabled: boolean },
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
  const result = await run(input.agent, input.input, { maxTurns: 3, tracingDisabled: true });
  return result.finalOutput;
}
