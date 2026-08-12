import {
  Email,
  PasswordHash,
  TokenFamilyId,
  User,
  UserId,
  Workspace,
  WorkspaceId,
} from '@flowmind/domain';

import { EmailAlreadyRegisteredError } from '../errors/email-already-registered-error.js';
import type { Clock } from '../ports/clock.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenService } from '../ports/token-service.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { WorkspaceRepository } from '../ports/workspace-repository.js';

import { issueSession, type AuthenticatedSession } from './auth-session.js';

export interface RegisterUserInput {
  email: string;
  password: string;
  workspaceName?: string;
}

/**
 * Creates a User and the one Workspace it owns, together, in a single
 * transaction (1 user : 1 workspace this release), then issues the first
 * session. Email validation and password strength live in the Domain value
 * objects (Email, PasswordHash) — this use case adds only the
 * "email not already taken" rule, which needs storage to check.
 */
export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthenticatedSession> {
    const email = Email.create(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await PasswordHash.hash(input.password);

    // Both ids are generated up front so each row can reference the other
    // without a second UPDATE — Workspace.ownerUserId is deliberately not a
    // foreign key for exactly this reason (see schema.prisma).
    const userId = UserId.generate();
    const workspaceId = WorkspaceId.generate();
    const createdAt = this.clock.now();

    const workspace = Workspace.create({
      id: workspaceId,
      name: input.workspaceName?.trim() || `${email.value}'s workspace`,
      ownerUserId: userId,
      createdAt,
    });
    const user = User.create({ id: userId, email, passwordHash, workspaceId, createdAt });

    await this.workspaceRepository.createWithOwner(workspace, user);

    return issueSession({
      user,
      familyId: TokenFamilyId.generate(),
      tokenService: this.tokenService,
      refreshTokenRepository: this.refreshTokenRepository,
      clock: this.clock,
    });
  }
}
