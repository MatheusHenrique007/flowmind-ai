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
  type Clock,
  type RefreshTokenRepository,
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

import { REFRESH_COOKIE_NAME } from '../auth/refresh-cookie.js';
import type { CompositionRoot } from '../composition-root.js';
import { loadEnv } from '../env.js';
import { buildServer } from '../server.js';

/**
 * In-memory doubles, hand written in the project's existing fake style — this
 * suite is about the HTTP contract (status codes, cookie attributes, what the
 * body does and does not contain), so it must not need Postgres or Redis.
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

function refreshCookieOf(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];
  const raw = Array.isArray(header) ? header.join(';') : String(header ?? '');
  const match = new RegExp(`${REFRESH_COOKIE_NAME}=([^;]*)`).exec(raw);
  return match?.[1] ?? '';
}

describe('auth and protected routes', () => {
  let app: FastifyInstance;
  let queue: RecordingWorkflowQueue;
  let workflows: InMemoryWorkflowRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const workspaces = new InMemoryWorkspaceRepository(users);
    refreshTokens = new InMemoryRefreshTokenRepository();
    workflows = new InMemoryWorkflowRepository();
    const runs = new InMemoryWorkflowRunRepository();
    queue = new RecordingWorkflowQueue();
    const tokenService = new JoseTokenService({ secret: TEST_ENV.ACCESS_TOKEN_SECRET });

    const root: CompositionRoot = {
      workflowQueue: queue,
      createWorkflow: new CreateWorkflow(workflows),
      updateWorkflow: new UpdateWorkflow(workflows),
      getWorkflowRun: new GetWorkflowRun(runs),
      listWorkflowRuns: new ListWorkflowRuns(runs),
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
    return {
      response,
      accessToken: response.json<{ accessToken: string }>().accessToken,
      refreshToken: refreshCookieOf(response),
    };
  }

  describe('POST /auth/register', () => {
    it('creates the account, returns an access token, and sets the refresh cookie', async () => {
      const { response, accessToken, refreshToken } = await register();

      expect(response.statusCode).toBe(201);
      expect(accessToken).not.toBe('');
      expect(refreshToken).not.toBe('');
      expect(response.json<{ user: { email: string } }>().user.email).toBe('owner@example.com');
    });

    it('never puts the refresh token in the response body', async () => {
      const { response, refreshToken } = await register();

      expect(response.body).not.toContain(decodeURIComponent(refreshToken));
      expect(response.json()).not.toHaveProperty('refreshToken');
    });

    it('marks the refresh cookie HttpOnly, SameSite=Lax and scoped to /auth', async () => {
      const { response } = await register();

      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/auth');
    });

    it('rejects a duplicate email with 409', async () => {
      await register();
      const { response } = await register();

      expect(response.statusCode).toBe(409);
    });

    it('rejects an invalid email with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'not-an-email', password: 'correct horse battery' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects a weak password with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'owner@example.com', password: 'short' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('issues a session for valid credentials', async () => {
      await register();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'owner@example.com', password: 'correct horse battery' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ accessToken: string }>().accessToken).not.toBe('');
      expect(refreshCookieOf(response)).not.toBe('');
    });

    it('answers a wrong password and an unknown email identically (401, same body)', async () => {
      await register();

      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'owner@example.com', password: 'wrong password' },
      });
      const unknownEmail = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nobody@example.com', password: 'correct horse battery' },
      });

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(unknownEmail.body).toBe(wrongPassword.body);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and returns a new access token', async () => {
      const { refreshToken } = await register();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(refreshCookieOf(response)).not.toBe(refreshToken);
    });

    it('rejects the old refresh token after rotation (single use)', async () => {
      const { refreshToken } = await register();
      await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });

      const replay = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });

      expect(replay.statusCode).toBe(401);
    });

    it('revokes the whole family when a rotated token is replayed', async () => {
      const { refreshToken } = await register();
      const rotated = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });
      const liveToken = refreshCookieOf(rotated);

      await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });

      const afterFamilyRevocation = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${liveToken}` },
      });
      expect(afterFamilyRevocation.statusCode).toBe(401);
      expect([...refreshTokens.tokens.values()].every((token) => token.isRevoked())).toBe(true);
    });

    it('401s with no cookie at all', async () => {
      const response = await app.inject({ method: 'POST', url: '/auth/refresh' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('invalidates the session and clears the cookie', async () => {
      const { refreshToken } = await register();

      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });

      expect(logout.statusCode).toBe(200);
      expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
      const afterLogout = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}` },
      });
      expect(afterLogout.statusCode).toBe(401);
    });

    it('succeeds with no session, revealing nothing', async () => {
      const response = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the caller’s own id, email and workspaceId', async () => {
      const { accessToken } = await register();

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ email: string }>().email).toBe('owner@example.com');
      expect(response.json<{ workspaceId: string }>().workspaceId).not.toBe('');
    });

    it.each([
      ['no header', undefined],
      ['a garbage token', 'Bearer not-a-jwt'],
      ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ])('401s with %s', async (_label, authorization) => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: authorization ? { authorization } : {},
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('protected workflow routes', () => {
    it('401s on every protected route without a token', async () => {
      for (const [method, url] of [
        ['POST', '/workflows'],
        ['PUT', '/workflows/some-id'],
        ['GET', '/workflow-runs'],
        ['GET', '/workflow-runs/some-id'],
        ['POST', '/webhooks/some-id'],
      ] as const) {
        const response = await app.inject({ method, url, payload: validWorkflowBody() });
        expect(response.statusCode, `${method} ${url}`).toBe(401);
      }
    });

    it('leaves /health public', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
    });

    it('creates a workflow in the token’s workspace, ignoring any workspace in the body', async () => {
      const { accessToken } = await register();

      const response = await app.inject({
        method: 'POST',
        url: '/workflows',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { ...validWorkflowBody(), workspaceId: 'attacker-supplied-workspace' },
      });

      expect(response.statusCode).toBe(201);
      const created = [...workflows.workflows.values()][0]!;
      expect(created.workspaceId.value).not.toBe('attacker-supplied-workspace');
    });

    it('404s — not 403 — when user A updates user B’s workflow', async () => {
      const userA = await register('a@example.com');
      const userB = await register('b@example.com');
      const createdByB = await app.inject({
        method: 'POST',
        url: '/workflows',
        headers: { authorization: `Bearer ${userB.accessToken}` },
        payload: validWorkflowBody('B owns this'),
      });
      const workflowId = createdByB.json<{ id: string }>().id;

      const response = await app.inject({
        method: 'PUT',
        url: `/workflows/${workflowId}`,
        headers: { authorization: `Bearer ${userA.accessToken}` },
        payload: validWorkflowBody('A tried to rename it'),
      });

      expect(response.statusCode).toBe(404);
      expect(workflows.workflows.get(workflowId)?.name).toBe('B owns this');
    });

    it('lists only the caller’s own workflow runs', async () => {
      const userA = await register('a@example.com');
      const userB = await register('b@example.com');

      const runsForA = await app.inject({
        method: 'GET',
        url: '/workflow-runs',
        headers: { authorization: `Bearer ${userA.accessToken}` },
      });
      const runsForB = await app.inject({
        method: 'GET',
        url: '/workflow-runs',
        headers: { authorization: `Bearer ${userB.accessToken}` },
      });

      expect(runsForA.json()).toEqual([]);
      expect(runsForB.json()).toEqual([]);
    });

    it('404s when user A reads user B’s workflow run id', async () => {
      const userA = await register('a@example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/workflow-runs/some-other-tenants-run',
        headers: { authorization: `Bearer ${userA.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('enqueues a webhook execution with the workspace from the token, not from the request', async () => {
      const { accessToken } = await register();

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/some-workflow-id',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { text: 'hi', workspaceId: 'attacker-supplied-workspace' },
      });

      expect(response.statusCode).toBe(202);
      expect(queue.enqueued).toHaveLength(1);
      expect(queue.enqueued[0]?.workspaceId).not.toBe('attacker-supplied-workspace');
    });
  });
});
