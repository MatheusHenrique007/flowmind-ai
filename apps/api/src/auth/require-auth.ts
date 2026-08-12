import type { TokenService } from '@flowmind/application';
import { UserId, WorkspaceId } from '@flowmind/domain';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

/** The authenticated identity a protected route is allowed to act on. */
export interface AuthContext {
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth; present on every route that installed the preHandler. */
    auth?: AuthContext;
  }
}

/**
 * Builds the authentication preHandler. It reads the Bearer access token,
 * verifies it, and puts `{ userId, workspaceId }` on the request — the only
 * place a route may get a workspace from. A client-supplied workspaceId (body,
 * query, header) is never consulted anywhere in this app.
 *
 * Missing, malformed, mis-signed, and expired tokens all produce the same 401
 * with the same body.
 */
export function buildRequireAuth(tokenService: TokenService): preHandlerAsyncHookHandler {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    if (!token) {
      await reply.status(401).send({ error: 'Unauthorized.' });
      return;
    }

    const claims = await tokenService.verifyAccessToken(token);
    if (!claims) {
      await reply.status(401).send({ error: 'Unauthorized.' });
      return;
    }

    try {
      request.auth = {
        userId: UserId.create(claims.userId),
        workspaceId: WorkspaceId.create(claims.workspaceId),
      };
    } catch {
      // A validly-signed token with unusable claims is still not a session.
      await reply.status(401).send({ error: 'Unauthorized.' });
    }
  };
}

/**
 * Narrows `request.auth` for handlers running behind requireAuth. Throwing here
 * would mean the preHandler was not installed — a wiring bug, not a request
 * error, so it must fail loudly rather than fall back to "no workspace".
 */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new Error('Route is missing the requireAuth preHandler.');
  }
  return request.auth;
}
