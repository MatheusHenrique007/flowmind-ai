import type { AIProvider } from '@flowmind/ai-contracts';
import { ClaudeProvider } from '@flowmind/ai-claude';
import { GeminiProvider } from '@flowmind/ai-gemini';
import { MockAIProvider } from '@flowmind/ai-mock';
import { OpenAIProvider } from '@flowmind/ai-openai';
import {
  CreateWorkflow,
  ExecuteWorkflow,
  GetCurrentUser,
  GetWorkflowRun,
  ListWorkflowRuns,
  LoginUser,
  LogoutUser,
  RefreshSession,
  RegisterUser,
  UpdateWorkflow,
  type TokenService,
  type WorkflowQueue,
} from '@flowmind/application';
import { SlackDestination } from '@flowmind/destinations-slack';
import { Provider, StepType } from '@flowmind/domain';
import {
  AIExecutor,
  type AIProviderResolver,
  DestinationExecutor,
  Engine,
  StepExecutorRegistry,
  TriggerExecutor,
} from '@flowmind/engine';
import {
  checkHealth,
  createPrismaClient,
  createRedisConnection,
  createWorkflowQueue,
  JoseTokenService,
  PrismaRefreshTokenRepository,
  PrismaUserRepository,
  PrismaWorkflowRepository,
  PrismaWorkflowRunRepository,
  PrismaWorkspaceRepository,
  startWorkflowWorker,
  SystemClock,
  type WorkflowWorker,
} from '@flowmind/infrastructure';

import type { Env } from './env.js';
import { buildHealthReport } from './health.js';

export interface HealthReport {
  api: 'ok';
  postgres: 'ok' | 'error';
  redis: 'ok' | 'error';
  queue: 'ok' | 'error';
  anthropic: 'configured' | 'not_configured';
  slack: 'configured' | 'not_configured';
}

export interface CompositionRoot {
  workflowQueue: WorkflowQueue;
  createWorkflow: CreateWorkflow;
  updateWorkflow: UpdateWorkflow;
  getWorkflowRun: GetWorkflowRun;
  listWorkflowRuns: ListWorkflowRuns;
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutUser: LogoutUser;
  getCurrentUser: GetCurrentUser;
  tokenService: TokenService;
  worker: WorkflowWorker;
  checkHealth: () => Promise<HealthReport>;
  shutdown: () => Promise<void>;
}

/**
 * Assembles every dependency for this process: Prisma repositories, the
 * Claude/Slack adapters, the Engine wired against the AIProvider/Destination
 * contracts (never against Claude/Slack directly), the BullMQ queue, and the
 * Worker that executes ExecuteWorkflow. Nothing outside this file wires
 * concrete adapters together.
 */
export function buildCompositionRoot(env: Env): CompositionRoot {
  const prisma = createPrismaClient();
  const redisConnection = createRedisConnection(env.REDIS_URL);

  const workflowRepository = new PrismaWorkflowRepository(prisma);
  const workflowRunRepository = new PrismaWorkflowRunRepository(prisma);
  const userRepository = new PrismaUserRepository(prisma);
  const workspaceRepository = new PrismaWorkspaceRepository(prisma);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);

  const clock = new SystemClock();
  const tokenService = new JoseTokenService({
    secret: env.ACCESS_TOKEN_SECRET,
    ttl: env.ACCESS_TOKEN_TTL,
  });

  // Each provider is decided once, here, at process boot: a real adapter
  // when its API key is present, otherwise MockAIProvider. This is a static
  // substitution, not a runtime fallback — see
  // docs/adr/0005-provider-selection-strategy.md.
  const providersByType: Record<Provider, AIProvider> = {
    [Provider.CLAUDE]: env.ANTHROPIC_API_KEY
      ? new ClaudeProvider({ apiKey: env.ANTHROPIC_API_KEY })
      : new MockAIProvider(),
    [Provider.OPENAI]: env.OPENAI_API_KEY
      ? new OpenAIProvider({ apiKey: env.OPENAI_API_KEY })
      : new MockAIProvider(),
    [Provider.GEMINI]: env.GEMINI_API_KEY
      ? new GeminiProvider({ apiKey: env.GEMINI_API_KEY })
      : new MockAIProvider(),
  };
  const resolveAIProvider: AIProviderResolver = (provider) => providersByType[provider];

  const slackDestination = new SlackDestination({ botToken: env.SLACK_BOT_TOKEN });

  const registry = new StepExecutorRegistry();
  registry.register(StepType.TRIGGER, new TriggerExecutor());
  registry.register(StepType.AI, new AIExecutor(resolveAIProvider));
  registry.register(StepType.DESTINATION, new DestinationExecutor(() => slackDestination));

  const engine = new Engine(registry, clock);
  const executeWorkflow = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);

  const workflowQueue = createWorkflowQueue(redisConnection);
  const worker = startWorkflowWorker({ connection: redisConnection, executeWorkflow });

  return {
    workflowQueue,
    createWorkflow: new CreateWorkflow(workflowRepository),
    updateWorkflow: new UpdateWorkflow(workflowRepository),
    getWorkflowRun: new GetWorkflowRun(workflowRunRepository),
    listWorkflowRuns: new ListWorkflowRuns(workflowRunRepository),
    registerUser: new RegisterUser(
      userRepository,
      workspaceRepository,
      refreshTokenRepository,
      tokenService,
      clock,
    ),
    loginUser: new LoginUser(userRepository, refreshTokenRepository, tokenService, clock),
    refreshSession: new RefreshSession(refreshTokenRepository, userRepository, tokenService, clock),
    logoutUser: new LogoutUser(refreshTokenRepository, clock),
    getCurrentUser: new GetCurrentUser(userRepository),
    tokenService,
    worker,
    checkHealth: async () => {
      const [dependencies, queue] = await Promise.all([
        checkHealth(prisma, redisConnection),
        workflowQueue.ping(),
      ]);
      return buildHealthReport(
        dependencies,
        queue,
        Boolean(env.ANTHROPIC_API_KEY),
        Boolean(env.SLACK_BOT_TOKEN),
      );
    },
    shutdown: async () => {
      await worker.close();
      await prisma.$disconnect();
      redisConnection.disconnect();
    },
  };
}
