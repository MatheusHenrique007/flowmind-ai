import { describe, expect, it } from 'vitest';

import { InvalidPasswordHashError } from '../errors/invalid-password-hash-error.js';
import { WeakPasswordError } from '../errors/weak-password-error.js';
import { PasswordHash } from '../value-objects/password-hash.js';

describe('PasswordHash', () => {
  it('never stores the plaintext password anywhere in its serialized value', async () => {
    const hash = await PasswordHash.hash('correct horse battery');

    expect(hash.value).not.toContain('correct horse battery');
    expect(hash.value.startsWith('scrypt$')).toBe(true);
  });

  it('verifies the password it was created from', async () => {
    const hash = await PasswordHash.hash('correct horse battery');
    await expect(hash.verify('correct horse battery')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await PasswordHash.hash('correct horse battery');
    await expect(hash.verify('wrong horse battery')).resolves.toBe(false);
    await expect(hash.verify('')).resolves.toBe(false);
  });

  it('produces a different hash for the same password (random per-password salt)', async () => {
    const first = await PasswordHash.hash('same password');
    const second = await PasswordHash.hash('same password');

    expect(first.value).not.toBe(second.value);
    await expect(second.verify('same password')).resolves.toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(PasswordHash.hash('short7!')).rejects.toThrow(WeakPasswordError);
  });

  it('round-trips through fromStored so a hash read from the database still verifies', async () => {
    const original = await PasswordHash.hash('correct horse battery');
    const reloaded = PasswordHash.fromStored(original.value);

    await expect(reloaded.verify('correct horse battery')).resolves.toBe(true);
  });

  it('refuses to rehydrate a value that is not a scrypt hash', () => {
    expect(() => PasswordHash.fromStored('plaintext-password')).toThrow(InvalidPasswordHashError);
    expect(() => PasswordHash.fromStored('bcrypt$1$2$3$4$5')).toThrow(InvalidPasswordHashError);
  });
});
