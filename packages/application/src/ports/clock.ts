/**
 * Not yet used by any use case in this release — ExecuteWorkflow never calls
 * `new Date()` itself, WorkflowRun's timestamps are the domain's own concern.
 * Defined now so the Engine (next implementation step) can depend on it from
 * day one instead of hardcoding `new Date()` into WorkflowStepResult creation,
 * where test determinism will actually matter.
 */
export interface Clock {
  now(): Date;
}
