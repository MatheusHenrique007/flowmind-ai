import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserNotFoundError,
  type AuthenticatedSession,
  type GetCurrentUser,
  type LoginUser,
  type LogoutUser,
  type RefreshSession,
  type RegisterUser,
} from '@flowmind/application';
import { InvalidEmailError, WeakPasswordError } from '@flowmind/domain';
import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { ZodError, z } from 'zod';

import { authOf } from '../auth/require-auth.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../auth/refresh-cookie.js';

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  workspaceName: z.string().optional(),
});

/**
 * Presentation only. Two rules this file exists to enforce:
 *
 * 1. The refresh token leaves the process exclusively as an httpOnly cookie —
 *    it is never put in a response body, where JavaScript (and any XSS) could
 *    read it. Only the 15-minute access token goes in the body.
 * 2. Failed logins map to one generic 401. The use case already collapses
 *    unknown-email and wrong-password into one error; this must not re-widen it
 *    by reporting validation details differently for the two cases.
 */
export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: {
    registerUser: RegisterUser;
    loginUser: LoginUser;
    refreshSession: RefreshSession;
    logoutUser: LogoutUser;
    getCurrentUser: GetCurrentUser;
    requireAuth: preHandlerAsyncHookHandler;
    secureCookies: boolean;
  },
): Promise<void> {
  const sendSession = (reply: FastifyReply, session: AuthenticatedSession, status: number) => {
    setRefreshCookie(reply, {
      token: session.refreshToken,
      expiresAt: session.refreshTokenExpiresAt,
      secure: deps.secureCookies,
    });
    return reply.status(status).send({ accessToken: session.accessToken, user: session.user });
  };

  app.post('/auth/register', async (request, reply) => {
    try {
      const input = credentialsSchema.parse(request.body);
      const session = await deps.registerUser.execute(input);
      return sendSession(reply, session, 201);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return reply.status(409).send({ error: error.message });
      }
      if (
        error instanceof ZodError ||
        error instanceof InvalidEmailError ||
        error instanceof WeakPasswordError
      ) {
        return reply.status(400).send({ error: describeValidationError(error) });
      }
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    try {
      const input = credentialsSchema.parse(request.body);
      const session = await deps.loginUser.execute(input);
      return sendSession(reply, session, 200);
    } catch (error) {
      // A malformed body is answered exactly like bad credentials: reporting
      // "email is required" vs "invalid credentials" differently would still
      // leak nothing here, but keeping one shape removes the temptation to add
      // per-field feedback to this endpoint later.
      if (error instanceof InvalidCredentialsError || error instanceof ZodError) {
        return reply.status(401).send({ error: new InvalidCredentialsError().message });
      }
      throw error;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const presented = readRefreshCookie(request);
    try {
      const session = await deps.refreshSession.execute(presented ?? '');
      return sendSession(reply, session, 200);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        // Clear the dead cookie so the browser stops presenting it.
        clearRefreshCookie(reply, { secure: deps.secureCookies });
        return reply.status(401).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    await deps.logoutUser.execute(readRefreshCookie(request));
    clearRefreshCookie(reply, { secure: deps.secureCookies });
    // 200 whether or not a session existed — logout is idempotent and reports
    // nothing about whether the presented token was real.
    return reply.status(200).send({ ok: true });
  });

  app.get('/auth/me', { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      return await deps.getCurrentUser.execute(authOf(request).userId);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        // A valid token for a user that no longer exists is not a session.
        return reply.status(401).send({ error: 'Unauthorized.' });
      }
      throw error;
    }
  });
}

function describeValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return 'email and password are required.';
  }
  return error instanceof Error ? error.message : 'Invalid request.';
}
