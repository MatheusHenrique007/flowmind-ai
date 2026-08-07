import { ExecutionContext, WorkflowRun, type WorkflowId } from '@flowmind/domain';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import type { WorkflowEngine } from '../ports/workflow-engine.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';
import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';

/**
 * Orchestrates a single Workflow execution. This class contains no
 * infrastructure logic — it only sequences calls to the domain and to the
 * ports it's given. See docs/prd/v0.2.0-execution-engine.md for the note on
 * why this persists the run three times instead of using a Unit of Work.
 */
export class ExecuteWorkflow {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly engine: WorkflowEngine,
  ) {}

  async execute(workflowId: WorkflowId, input: unknown): Promise<WorkflowRun> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const run = WorkflowRun.create({ workflowId });
    await this.workflowRunRepository.save(run);

    run.start();
    await this.workflowRunRepository.save(run);

    const context = ExecutionContext.create(input);
    const result = await this.engine.execute(workflow, context);

    for (const stepResult of result.stepResults) {
      run.recordStepResult(stepResult);
    }

    if (result.success) {
      run.complete();
    } else {
      run.fail();
    }

    await this.workflowRunRepository.save(run);

    return run;
  }
}
