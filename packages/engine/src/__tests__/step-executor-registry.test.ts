import { StepType } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { TriggerExecutor } from '../executors/trigger-executor.js';
import { StepExecutorRegistry } from '../step-executor-registry.js';

describe('StepExecutorRegistry', () => {
  it('reports false via has() for an unregistered type', () => {
    const registry = new StepExecutorRegistry();
    expect(registry.has(StepType.TRIGGER)).toBe(false);
  });

  it('reports true via has() after registering an executor', () => {
    const registry = new StepExecutorRegistry();
    registry.register(StepType.TRIGGER, new TriggerExecutor());
    expect(registry.has(StepType.TRIGGER)).toBe(true);
  });

  it('resolves the executor registered for a type', () => {
    const registry = new StepExecutorRegistry();
    const executor = new TriggerExecutor();
    registry.register(StepType.TRIGGER, executor);
    expect(registry.resolve(StepType.TRIGGER)).toBe(executor);
  });

  it('throws when resolving an unregistered type', () => {
    const registry = new StepExecutorRegistry();
    expect(() => registry.resolve(StepType.AI)).toThrow(/No StepExecutor registered/);
  });
});
