import { ClaudeProvider } from '@flowmind/ai-claude';
import {
  ExecuteWorkflow,
  GetWorkflowRun,
  ListWorkflowRuns,
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

export interface CompositionRoot {
  workflowQueue: WorkflowQueue;
  getWorkflowRun: GetWorkflowRun;
  listWorkflowRuns: ListWorkflowRuns;
  worker: WorkflowWorker;
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
    getWorkflowRun: new GetWorkflowRun(workflowRunRepository),
    listWorkflowRuns: new ListWorkflowRuns(workflowRunRepository),
    worker,
    shutdown: async () => {
      await worker.close();
      await prisma.$disconnect();
      redisConnection.disconnect();
    },
  };
}
