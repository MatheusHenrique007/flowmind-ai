import { ClaudeProvider } from '@flowmind/ai-claude';
import {
  CreateWorkflow,
  ExecuteWorkflow,
  GetWorkflowRun,
  ListWorkflowRuns,
  UpdateWorkflow,
  type WorkflowQueue,
} from '@flowmind/application';
import { SlackDestination } from '@flowmind/destinations-slack';
import { StepType } from '@flowmind/domain';
import {
  AIExecutor,
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
  PrismaWorkflowRepository,
  PrismaWorkflowRunRepository,
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

  const claudeProvider = new ClaudeProvider({ apiKey: env.ANTHROPIC_API_KEY });
  const slackDestination = new SlackDestination({ botToken: env.SLACK_BOT_TOKEN });

  const registry = new StepExecutorRegistry();
  registry.register(StepType.TRIGGER, new TriggerExecutor());
  registry.register(StepType.AI, new AIExecutor(() => claudeProvider));
  registry.register(StepType.DESTINATION, new DestinationExecutor(() => slackDestination));

  const engine = new Engine(registry, new SystemClock());
  const executeWorkflow = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);

  const workflowQueue = createWorkflowQueue(redisConnection);
  const worker = startWorkflowWorker({ connection: redisConnection, executeWorkflow });

  return {
    workflowQueue,
    createWorkflow: new CreateWorkflow(workflowRepository),
    updateWorkflow: new UpdateWorkflow(workflowRepository),
    getWorkflowRun: new GetWorkflowRun(workflowRunRepository),
    listWorkflowRuns: new ListWorkflowRuns(workflowRunRepository),
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
