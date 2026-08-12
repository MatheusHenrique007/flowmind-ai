import {
  CreateSchedule,
  CreateWorkflow,
  DeleteSchedule,
  ExecuteWorkflow,
  GetCurrentUser,
  GetWorkflow,
  GetWorkflowRun,
  ListSchedules,
  ListWorkflowRuns,
  ListWorkflows,
  LoginUser,
  LogoutUser,
  RefreshSession,
  RegisterUser,
  UpdateWorkflow,
  type Clock,
  type RefreshTokenRepository,
  type ScheduleQueue,
  type ScheduleRepository,
  type UserRepository,
  type WorkflowQueue,
  type WorkflowRepository,
  type WorkflowRunRepository,
  type WorkflowRunView,
  type WorkspaceRepository,
} from '@flowmind/application';
import {
  DestinationKind,
  Provider,
  type Email,
  type RefreshToken,
  type Schedule,
  type ScheduleId,
  type TokenFamilyId,
  type User,
  type UserId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type Workspace,
  type WorkspaceId,
} from '@flowmind/domain';
import { JoseTokenService } from '@flowmind/infrastructure';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CompositionRoot } from '../composition-root.js';
import { loadEnv } from '../env.js';
import { buildServer } from '../server.js';

/**
 * Same in-memory-double style as auth.test.ts's "protected workflow routes"
 * section — this suite only cares about the HTTP contract for the new
 * GET /workflows and GET /workflows/:id routes, so it does not need Postgres
 * or Redis.
 */
class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  async findByEmail(email: Email) {
    return [...this.users.values()].find((user) => user.email.equals(email)) ?? null;
  }
  async findById(id: UserId) {
    return this.users.get(id.value) ?? null;
  }
  async save(user: User) {
    this.users.set(user.id.value, user);
  }
}

class InMemoryWorkspaceRepository implements WorkspaceRepository {
  readonly workspaces = new Map<string, Workspace>();
  constructor(private readonly users: InMemoryUserRepository) {}
  async findById(id: WorkspaceId) {
    return this.workspaces.get(id.value) ?? null;
  }
  async save(workspace: Workspace) {
    this.workspaces.set(workspace.id.value, workspace);
  }
  async createWithOwner(workspace: Workspace, owner: User) {
    this.workspaces.set(workspace.id.value, workspace);
    await this.users.save(owner);
  }
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens = new Map<string, RefreshToken>();
  async save(token: RefreshToken) {
    this.tokens.set(token.tokenHash, token);
  }
  async findByTokenHash(tokenHash: string) {
    return this.tokens.get(tokenHash) ?? null;
  }
  async revokeFamily(familyId: TokenFamilyId, revokedAt: Date) {
    for (const token of this.tokens.values()) {
      if (token.familyId.equals(familyId)) {
        token.revoke(revokedAt);
      }
    }
  }
}

class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly workflows = new Map<string, Workflow>();
  async findById(id: WorkflowId, workspaceId: WorkspaceId) {
    const workflow = this.workflows.get(id.value);
    return workflow && workflow.workspaceId.equals(workspaceId) ? workflow : null;
  }
  async save(workflow: Workflow) {
    this.workflows.set(workflow.id.value, workflow);
  }
  async listByWorkspace(workspaceId: WorkspaceId) {
    return [...this.workflows.values()].filter((w) => w.workspaceId.equals(workspaceId));
  }
}

class InMemoryWorkflowRunRepository implements WorkflowRunRepository {
  readonly runs = new Map<string, { workspaceId: string; view: WorkflowRunView }>();
  async save(run: WorkflowRun) {
    this.runs.set(run.id.value, {
      workspaceId: run.workspaceId.value,
      view: {
        id: run.id.value,
        workflowId: run.workflowId.value,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stepResults: [],
      },
    });
  }
  async findViewById(id: WorkflowRunId, workspaceId: WorkspaceId) {
    const stored = this.runs.get(id.value);
    return stored && stored.workspaceId === workspaceId.value ? stored.view : null;
  }
  async listViews(workspaceId: WorkspaceId) {
    return [...this.runs.values()]
      .filter((stored) => stored.workspaceId === workspaceId.value)
      .map((stored) => stored.view);
  }
}

class RecordingWorkflowQueue implements WorkflowQueue {
  readonly enqueued: { workspaceId: string; workflowId: string; payload: unknown }[] = [];
  async enqueue(workspaceId: WorkspaceId, workflowId: WorkflowId, payload: unknown) {
    this.enqueued.push({
      workspaceId: workspaceId.value,
      workflowId: workflowId.value,
      payload,
    });
  }
}

class InMemoryScheduleRepository implements ScheduleRepository {
  readonly schedules = new Map<string, Schedule>();
  async save(schedule: Schedule) {
    this.schedules.set(schedule.id.value, schedule);
  }
  async findById(id: ScheduleId, workspaceId: WorkspaceId) {
    const schedule = this.schedules.get(id.value);
    return schedule && schedule.workspaceId.equals(workspaceId) ? schedule : null;
  }
  async listByWorkspace(workspaceId: WorkspaceId) {
    return [...this.schedules.values()].filter((s) => s.workspaceId.equals(workspaceId));
  }
  async delete(id: ScheduleId, workspaceId: WorkspaceId) {
    const schedule = this.schedules.get(id.value);
    if (schedule && schedule.workspaceId.equals(workspaceId)) {
      this.schedules.delete(id.value);
    }
  }
  async countByWorkspace(workspaceId: WorkspaceId) {
    return (await this.listByWorkspace(workspaceId)).length;
  }
}

class InMemoryScheduleQueue implements ScheduleQueue {
  readonly registered = new Map<string, Schedule>();
  async register(schedule: Schedule) {
    this.registered.set(schedule.id.value, schedule);
  }
  async unregister(scheduleId: ScheduleId) {
    this.registered.delete(scheduleId.value);
  }
}

const systemClock: Clock = { now: () => new Date() };

const TEST_ENV = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused',
  REDIS_URL: 'redis://unused',
  ACCESS_TOKEN_SECRET: 'x'.repeat(40),
  WEB_ORIGIN: 'http://localhost:3000',
} as NodeJS.ProcessEnv);

function validWorkflowBody(name = 'Webhook to Slack') {
  return {
    name,
    steps: [
      { type: 'TRIGGER', kind: 'webhook' },
      { type: 'AI', provider: Provider.CLAUDE, instruction: 'Summarize.' },
      { type: 'DESTINATION', destination: DestinationKind.SLACK, target: '#alerts' },
    ],
  };
}

describe('GET /workflows and GET /workflows/:id', () => {
  let app: FastifyInstance;
  let workflows: InMemoryWorkflowRepository;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const workspaces = new InMemoryWorkspaceRepository(users);
    const refreshTokens = new InMemoryRefreshTokenRepository();
    workflows = new InMemoryWorkflowRepository();
    const runs = new InMemoryWorkflowRunRepository();
    const queue = new RecordingWorkflowQueue();
    const tokenService = new JoseTokenService({ secret: TEST_ENV.ACCESS_TOKEN_SECRET });

    const schedules = new InMemoryScheduleRepository();
    const scheduleQueue = new InMemoryScheduleQueue();

    const root: CompositionRoot = {
      workflowQueue: queue,
      scheduleQueue,
      createWorkflow: new CreateWorkflow(workflows),
      updateWorkflow: new UpdateWorkflow(workflows),
      listWorkflows: new ListWorkflows(workflows),
      getWorkflow: new GetWorkflow(workflows),
      getWorkflowRun: new GetWorkflowRun(runs, workflows),
      listWorkflowRuns: new ListWorkflowRuns(runs, workflows),
      createSchedule: new CreateSchedule(schedules, scheduleQueue, workflows),
      listSchedules: new ListSchedules(schedules),
      deleteSchedule: new DeleteSchedule(schedules, scheduleQueue),
      computeNextRunAt: async () => null,
      registerUser: new RegisterUser(users, workspaces, refreshTokens, tokenService, systemClock),
      loginUser: new LoginUser(users, refreshTokens, tokenService, systemClock),
      refreshSession: new RefreshSession(refreshTokens, users, tokenService, systemClock),
      logoutUser: new LogoutUser(refreshTokens, systemClock),
      getCurrentUser: new GetCurrentUser(users),
      tokenService,
      worker: undefined as unknown as CompositionRoot['worker'],
      checkHealth: async () => ({
        api: 'ok',
        postgres: 'ok',
        redis: 'ok',
        queue: 'ok',
        anthropic: 'not_configured',
        slack: 'not_configured',
      }),
      shutdown: async () => {},
    };
    // Present so the type is satisfied; no route in this suite touches the
    // Engine or the Worker.
    void new ExecuteWorkflow(workflows, runs, {
      execute: async () => {
        throw new Error('not used');
      },
    });

    app = await buildServer(root, TEST_ENV);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function register(email = 'owner@example.com', password = 'correct horse battery') {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password },
    });
    return { accessToken: response.json<{ accessToken: string }>().accessToken };
  }

  async function createWorkflow(accessToken: string, name = 'Webhook to Slack') {
    const response = await app.inject({
      method: 'POST',
      url: '/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validWorkflowBody(name),
    });
    return response.json<{ id: string; name: string }>();
  }

  it('401s on GET /workflows and GET /workflows/:id without a token', async () => {
    for (const url of ['/workflows', '/workflows/some-id']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(401);
    }
  });

  it('returns an empty list for a fresh workspace', async () => {
    const { accessToken } = await register();

    const response = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("lists only the authenticated workspace's workflows", async () => {
    const userA = await register('a@example.com');
    const userB = await register('b@example.com');
    await createWorkflow(userA.accessToken, 'A1');
    await createWorkflow(userA.accessToken, 'A2');
    await createWorkflow(userB.accessToken, 'B1');

    const response = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${userA.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const names = response
      .json<{ id: string; name: string }[]>()
      .map((w) => w.name)
      .sort();
    expect(names).toEqual(['A1', 'A2']);
  });

  it("returns full detail (including steps) for the caller's own workflow", async () => {
    const { accessToken } = await register();
    const created = await createWorkflow(accessToken, 'Detail me');

    const response = await app.inject({
      method: 'GET',
      url: `/workflows/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ id: string; name: string; steps: unknown[] }>();
    expect(body.name).toBe('Detail me');
    expect(body.steps).toHaveLength(3);
    expect(body.steps[0]).toMatchObject({ type: 'TRIGGER', kind: 'webhook' });
  });

  it('404s for a nonexistent workflow id', async () => {
    const { accessToken } = await register();

    const response = await app.inject({
      method: 'GET',
      url: '/workflows/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("404s — not 403 — when user A reads user B's workflow", async () => {
    const userA = await register('a@example.com');
    const userB = await register('b@example.com');
    const created = await createWorkflow(userB.accessToken, 'B owns this');

    const response = await app.inject({
      method: 'GET',
      url: `/workflows/${created.id}`,
      headers: { authorization: `Bearer ${userA.accessToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
