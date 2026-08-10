import type { Email } from '../value-objects/email.js';
import type { PasswordHash } from '../value-objects/password-hash.js';
import { UserId } from '../value-objects/user-id.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';

/**
 * An authenticated account. Holds a PasswordHash value object, never a
 * plaintext password — there is no code path in this entity that can see or
 * store one.
 */
export class User {
  readonly id: UserId;
  readonly email: Email;
  readonly passwordHash: PasswordHash;
  readonly workspaceId: WorkspaceId;
  readonly createdAt: Date;

  private constructor(
    id: UserId,
    email: Email,
    passwordHash: PasswordHash,
    workspaceId: WorkspaceId,
    createdAt: Date,
  ) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.workspaceId = workspaceId;
    this.createdAt = createdAt;
  }

  static create(params: {
    id?: UserId;
    email: Email;
    passwordHash: PasswordHash;
    workspaceId: WorkspaceId;
    createdAt?: Date;
  }): User {
    return new User(
      params.id ?? UserId.generate(),
      params.email,
      params.passwordHash,
      params.workspaceId,
      params.createdAt ?? new Date(),
    );
  }

  /** Delegates to the value object; the entity never touches the raw hash. */
  async verifyPassword(plain: string): Promise<boolean> {
    return this.passwordHash.verify(plain);
  }
}
