import { InvalidExecutionContextError } from '../errors/invalid-execution-context-error.js';

/**
 * Immutable state threaded through a WorkflowRun's steps. Each step reads
 * what it needs and returns a *new* ExecutionContext via `with(...)` rather
 * than mutating shared state — steps never call each other directly, they
 * only ever hand off through this object (ADR-0002).
 */
export class ExecutionContext {
  private readonly data: ReadonlyMap<string, unknown>;

  private constructor(data: ReadonlyMap<string, unknown>) {
    this.data = data;
  }

  static create(input: unknown): ExecutionContext {
    if (input === null || input === undefined) {
      throw new InvalidExecutionContextError('input must not be null or undefined.');
    }
    return new ExecutionContext(new Map([['input', input]]));
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  with(key: string, value: unknown): ExecutionContext {
    const next = new Map(this.data);
    next.set(key, value);
    return new ExecutionContext(next);
  }
}
