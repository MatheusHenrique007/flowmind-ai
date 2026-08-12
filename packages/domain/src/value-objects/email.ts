import { InvalidEmailError } from '../errors/invalid-email-error.js';

/**
 * Deliberately a pragmatic shape check, not RFC 5322: the only thing this
 * release needs is that an address is a single non-empty local part, an `@`,
 * and a dotted domain. Normalized to lower case so `A@b.com` and `a@b.com`
 * can never become two accounts (the `users.email` unique index alone would
 * not catch that).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (value.length === 0) {
      throw new InvalidEmailError('must not be empty.');
    }
    if (value.length > 254) {
      throw new InvalidEmailError('must be at most 254 characters.');
    }
    if (!EMAIL_PATTERN.test(value)) {
      throw new InvalidEmailError(`"${raw}" is not a valid email address.`);
    }
    return new Email(value);
  }

  equals(other: Email): boolean {
    return other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}
