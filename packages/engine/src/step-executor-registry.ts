import type { StepType } from '@flowmind/domain';

import type { StepExecutor } from './step-executor.js';

/**
 * Resolves a StepExecutor by StepType so the Engine never branches on type
 * itself — adding a fourth StepType means registering one more executor
 * here, not editing the Engine's loop.
 */
export class StepExecutorRegistry {
  private readonly executors = new Map<StepType, StepExecutor>();

  register(type: StepType, executor: StepExecutor): void {
    this.executors.set(type, executor);
  }

  has(type: StepType): boolean {
    return this.executors.has(type);
  }

  resolve(type: StepType): StepExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No StepExecutor registered for step type "${type}".`);
    }
    return executor;
  }
}
