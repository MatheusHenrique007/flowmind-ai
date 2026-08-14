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
  Workflow,
  WorkflowStep,
  WorkspaceId,
  type Email,
  type RefreshToken,
  type Schedule,
  type ScheduleId,
  type TokenFamilyId,
  type User,
  type UserId,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type Workspace,
} from '@flowmind/domain';
import { JoseTokenService } from '@flowmind/infrastructure';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CompositionRoot } from '../composition-root.js';
import { loadEnv } from '../env.js';
import { buildServer } from '../server.js';

/**
 * Same in-memory-doubles style as auth.test.ts — this suite is about the
 * HTTP contract (status codes, cross-tenant isolation, request/response
 * shapes), so it must not need real Postgres or Redis.
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
  async enqueue() {
    // not exercised by this suite
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
  shouldFailRegister = false;
  async register(schedule: Schedule) {
    if (this.shouldFailRegister) {
      throw new Error('simulated queue failure');
    }
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

describe('schedules routes', () => {
  let app: FastifyInstance;
  let workflows: InMemoryWorkflowRepository;
  let scheduleQueue: InMemoryScheduleQueue;
  let scheduleRepository: InMemoryScheduleRepository;

  async function registerAndLogin(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'correct horse battery' },
    });
    return response.json<{ accessToken: string }>().accessToken;
  }

  function authHeader(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const workspaces = new InMemoryWorkspaceRepository(users);
    const refreshTokens = new InMemoryRefreshTokenRepository();
    workflows = new InMemoryWorkflowRepository();
    const runs = new InMemoryWorkflowRunRepository();
    const queue = new RecordingWorkflowQueue();
    scheduleRepository = new InMemoryScheduleRepository();
    scheduleQueue = new InMemoryScheduleQueue();
    const tokenService = new JoseTokenService({ secret: TEST_ENV.ACCESS_TOKEN_SECRET });

    const root: CompositionRoot = {
      workflowQueue: queue,
      scheduleQueue,
      createWorkflow: new CreateWorkflow(workflows),
      updateWorkflow: new UpdateWorkflow(workflows),
      listWorkflows: new ListWorkflows(workflows),
      getWorkflow: new GetWorkflow(workflows),
      getWorkflowRun: new GetWorkflowRun(runs, workflows),
      listWorkflowRuns: new ListWorkflowRuns(runs, workflows),
      createSchedule: new CreateSchedule(scheduleRepository, scheduleQueue, workflows),
      listSchedules: new ListSchedules(scheduleRepository),
      deleteSchedule: new DeleteSchedule(scheduleRepository, scheduleQueue),
      computeNextRunAt: async (scheduleId: string) =>
        scheduleQueue.registered.has(scheduleId) ? new Date('2026-08-12T13:00:00Z') : null,
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

  function seedWorkflow(workspaceId: WorkspaceId) {
    const workflow = Workflow.create({
      name: 'Webhook to Slack',
      steps: [
        WorkflowStep.trigger({ kind: 'webhook' }),
        WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
        WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
      ],
      workspaceId,
    });
    workflows.workflows.set(workflow.id.value, workflow);
    return workflow;
  }

  it('rejects unauthenticated requests with 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/schedules' });
    expect(response.statusCode).toBe(401);
  });

  it('creates a schedule, then lists it with nextRunAt', async () => {
    const token = await registerAndLogin('owner1@example.com');
    // Derive the workspace by decoding the token payload workspaceId isn't
    // exposed directly, so seed via the workflow repository using any
    // workspaceId — the create call itself proves scoping since it uses the
    // token's own workspace, verified by round-tripping through the API.
    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeader(token),
    });
    const { workspaceId } = meResponse.json<{ workspaceId: string }>();
    const workflow = seedWorkflow(WorkspaceId.create(workspaceId));

    const createResponse = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(token),
      payload: { workflowId: workflow.id.value, cronExpression: '*/5 * * * *' },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<{ id: string; nextRunAt: string }>();
    expect(created.nextRunAt).toBe('2026-08-12T13:00:00.000Z');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/schedules',
      headers: authHeader(token),
    });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json<{ id: string }[]>();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
  });

  it('returns 404 when creating a schedule for a workflow belonging to another workspace', async () => {
    const tokenA = await registerAndLogin('tenantA@example.com');
    const tokenB = await registerAndLogin('tenantB@example.com');
    const meB = await app.inject({ method: 'GET', url: '/auth/me', headers: authHeader(tokenB) });
    const { workspaceId: workspaceBId } = meB.json<{ workspaceId: string }>();
    const workflowB = seedWorkflow(WorkspaceId.create(workspaceBId));

    const response = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(tokenA),
      payload: { workflowId: workflowB.id.value, cronExpression: '* * * * *' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for an invalid cron expression', async () => {
    const token = await registerAndLogin('owner2@example.com');
    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeader(token),
    });
    const { workspaceId } = meResponse.json<{ workspaceId: string }>();
    const workflow = seedWorkflow(WorkspaceId.create(workspaceId));

    const response = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(token),
      payload: { workflowId: workflow.id.value, cronExpression: 'not-a-cron' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects the 21st schedule in a workspace with 409', async () => {
    const token = await registerAndLogin('owner3@example.com');
    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeader(token),
    });
    const { workspaceId } = meResponse.json<{ workspaceId: string }>();
    const workflow = seedWorkflow(WorkspaceId.create(workspaceId));

    for (let i = 0; i < 20; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/schedules',
        headers: authHeader(token),
        payload: { workflowId: workflow.id.value, cronExpression: '0 0 * * *' },
      });
      expect(response.statusCode).toBe(201);
    }

    const response = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(token),
      payload: { workflowId: workflow.id.value, cronExpression: '0 0 * * *' },
    });
    expect(response.statusCode).toBe(409);
  });

  it('deletes a schedule (204) and it disappears from the list', async () => {
    const token = await registerAndLogin('owner4@example.com');
    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeader(token),
    });
    const { workspaceId } = meResponse.json<{ workspaceId: string }>();
    const workflow = seedWorkflow(WorkspaceId.create(workspaceId));
    const createResponse = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(token),
      payload: { workflowId: workflow.id.value, cronExpression: '* * * * *' },
    });
    const { id } = createResponse.json<{ id: string }>();

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/schedules/${id}`,
      headers: authHeader(token),
    });
    expect(deleteResponse.statusCode).toBe(204);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/schedules',
      headers: authHeader(token),
    });
    expect(listResponse.json<unknown[]>()).toHaveLength(0);
  });

  it("returns 404 deleting another workspace's schedule (cross-tenant)", async () => {
    const tokenA = await registerAndLogin('tenantC@example.com');
    const tokenD = await registerAndLogin('tenantD@example.com');
    const meA = await app.inject({ method: 'GET', url: '/auth/me', headers: authHeader(tokenA) });
    const { workspaceId: workspaceAId } = meA.json<{ workspaceId: string }>();
    const workflowA = seedWorkflow(WorkspaceId.create(workspaceAId));
    const createResponse = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(tokenA),
      payload: { workflowId: workflowA.id.value, cronExpression: '* * * * *' },
    });
    const { id } = createResponse.json<{ id: string }>();

    const response = await app.inject({
      method: 'DELETE',
      url: `/schedules/${id}`,
      headers: authHeader(tokenD),
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns an empty list for GET /schedules on a workspace with none, never another tenant's", async () => {
    const tokenA = await registerAndLogin('tenantE@example.com');
    const tokenF = await registerAndLogin('tenantF@example.com');
    const meF = await app.inject({ method: 'GET', url: '/auth/me', headers: authHeader(tokenF) });
    const { workspaceId: workspaceFId } = meF.json<{ workspaceId: string }>();
    const workflowF = seedWorkflow(WorkspaceId.create(workspaceFId));
    await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(tokenF),
      payload: { workflowId: workflowF.id.value, cronExpression: '* * * * *' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/schedules',
      headers: authHeader(tokenA),
    });
    expect(response.json<unknown[]>()).toHaveLength(0);
  });

  it('returns 502 when the queue backend fails to register the schedule', async () => {
    const token = await registerAndLogin('owner5@example.com');
    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeader(token),
    });
    const { workspaceId } = meResponse.json<{ workspaceId: string }>();
    const workflow = seedWorkflow(WorkspaceId.create(workspaceId));
    scheduleQueue.shouldFailRegister = true;

    const response = await app.inject({
      method: 'POST',
      url: '/schedules',
      headers: authHeader(token),
      payload: { workflowId: workflow.id.value, cronExpression: '* * * * *' },
    });
    expect(response.statusCode).toBe(502);
    expect(scheduleRepository.schedules.size).toBe(0);
  });
});
