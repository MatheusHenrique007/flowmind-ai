import { describe, expect, it } from 'vitest';

import { InvalidEmailError } from '../errors/invalid-email-error.js';
import { Email } from '../value-objects/email.js';

describe('Email', () => {
  it('accepts a normal address', () => {
    expect(Email.create('user@example.com').value).toBe('user@example.com');
  });

  it('normalizes case and surrounding whitespace so one address cannot become two accounts', () => {
    expect(Email.create('  User@Example.COM  ').value).toBe('user@example.com');
  });

  it('treats two differently-cased spellings of the same address as equal', () => {
    expect(Email.create('A@b.com').equals(Email.create('a@b.com'))).toBe(true);
  });

  it.each(['', '   ', 'no-at-sign', 'no@domain', 'two@@ats.com', 'spaces in@mail.com', '@b.com'])(
    'rejects %j',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );
});
