import type { ExecutionContext, Workflow } from '@flowmind/domain';

import type { WorkflowEngine, WorkflowExecutionResult } from '../../ports/workflow-engine.js';

export class FakeWorkflowEngine implements WorkflowEngine {
  private result: WorkflowExecutionResult | undefined;
  private error: Error | undefined;
  public lastCall: { workflow: Workflow; context: ExecutionContext } | undefined;

  willReturn(result: WorkflowExecutionResult): void {
    this.result = result;
    this.error = undefined;
  }

  willThrow(error: Error): void {
    this.error = error;
    this.result = undefined;
  }

  async execute(workflow: Workflow, context: ExecutionContext): Promise<WorkflowExecutionResult> {
    this.lastCall = { workflow, context };
    if (this.error) {
      throw this.error;
    }
    if (!this.result) {
      throw new Error('FakeWorkflowEngine.execute called before willReturn/willThrow was set.');
    }
    return this.result;
  }
}
