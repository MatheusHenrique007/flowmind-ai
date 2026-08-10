import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { InvalidPasswordHashError } from '../errors/invalid-password-hash-error.js';
import { WeakPasswordError } from '../errors/weak-password-error.js';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** OWASP-suggested scrypt work factors; stored in the hash so they can change later. */
const COST = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;

/**
 * A password's derived hash — never the plaintext. Uses `node:crypto`'s
 * scrypt (see docs/adr/0003-authentication-token-strategy.md): Node's
 * standard library, so this stays a Domain value object with no new
 * dependency and no infrastructure port, matching the precedent already set
 * by EntityId using `randomUUID`.
 *
 * Serialized form: `scrypt$<N>$<r>$<p>$<saltHex>$<keyHex>` — self-describing,
 * so the cost parameters can be raised later without invalidating existing
 * hashes.
 */
export class PasswordHash {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Rehydrates a hash read from storage. Does not accept arbitrary strings. */
  static fromStored(value: string): PasswordHash {
    PasswordHash.parse(value);
    return new PasswordHash(value);
  }

  static async hash(plain: string): Promise<PasswordHash> {
    if (plain.length < MIN_PASSWORD_LENGTH) {
      throw new WeakPasswordError(`must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (plain.length > MAX_PASSWORD_LENGTH) {
      throw new WeakPasswordError(`must be at most ${MAX_PASSWORD_LENGTH} characters.`);
    }

    const salt = randomBytes(SALT_LENGTH);
    const key = await scrypt(plain, salt, KEY_LENGTH, COST);

    return new PasswordHash(
      [ALGORITHM, COST.N, COST.r, COST.p, salt.toString('hex'), key.toString('hex')].join('$'),
    );
  }

  /**
   * Constant-time comparison via `timingSafeEqual` — a plain `===` on the
   * derived key would leak how many leading bytes matched.
   */
  async verify(plain: string): Promise<boolean> {
    if (plain.length === 0 || plain.length > MAX_PASSWORD_LENGTH) {
      return false;
    }

    const parsed = PasswordHash.parse(this.value);
    const candidate = await scrypt(plain, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });

    return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
  }

  toString(): string {
    return this.value;
  }

  private static parse(value: string): {
    N: number;
    r: number;
    p: number;
    salt: Buffer;
    key: Buffer;
  } {
    const parts = value.split('$');
    if (parts.length !== 6 || parts[0] !== ALGORITHM) {
      throw new InvalidPasswordHashError();
    }

    const [, rawN, rawR, rawP, saltHex, keyHex] = parts as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      throw new InvalidPasswordHashError();
    }

    const salt = Buffer.from(saltHex, 'hex');
    const key = Buffer.from(keyHex, 'hex');
    if (salt.length === 0 || key.length === 0) {
      throw new InvalidPasswordHashError();
    }

    return { N, r, p, salt, key };
  }
}
