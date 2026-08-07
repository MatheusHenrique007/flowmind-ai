import { randomUUID } from 'node:crypto';

import { InvalidIdError } from '../errors/invalid-id-error.js';

/**
 * Base for typed identifier value objects (WorkflowId, WorkflowRunId, ...).
 * Wrapping a bare string prevents accidentally passing a WorkflowId where a
 * WorkflowRunId is expected — a mistake the type checker cannot catch on
 * `string` alone.
 */
export abstract class EntityId {
  readonly value: string;

  protected constructor(value: string, typeName: string) {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdError(typeName);
    }
    this.value = value;
  }

  equals(other: EntityId): boolean {
    return other.constructor === this.constructor && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }

  protected static generateValue(): string {
    return randomUUID();
  }
}
