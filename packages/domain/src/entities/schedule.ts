import { InvalidCronExpressionError } from '../errors/invalid-cron-expression-error.js';
import { ScheduleId } from '../value-objects/schedule-id.js';
import type { WorkflowId } from '../value-objects/workflow-id.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';

/**
 * A field of a cron expression may be a wildcard, a single number, a
 * comma-separated list of numbers, a range "a-b", or a step "wildcard-slash-n"
 * or "a-b-slash-n", where every number present must fall within [min, max].
 * This is intentionally
 * hand-rolled (no cron-parser dependency in Domain) — it only needs to reject
 * structurally invalid expressions, not resolve next-run timestamps (that is
 * an Infrastructure concern; see ADR-0006).
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === '*') {
    return true;
  }

  return field.split(',').every((part) => {
    const stepMatch = /^(\*|\d+(?:-\d+)?)\/(\d+)$/.exec(part);
    const term = stepMatch ? stepMatch[1] : part;
    const step = stepMatch ? stepMatch[2] : undefined;

    if (step !== undefined && Number(step) <= 0) {
      return false;
    }

    if (term === '*') {
      return true;
    }

    const rangeMatch = /^(\d+)-(\d+)$/.exec(term as string);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      return start >= min && start <= max && end >= min && end <= max && start <= end;
    }

    if (!/^\d+$/.test(term as string)) {
      return false;
    }

    const value = Number(term);
    return value >= min && value <= max;
  });
}

const FIELD_RANGES: readonly [min: number, max: number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week (0 and 7 both denote Sunday)
];

function assertValidCron(cronExpression: string): void {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new InvalidCronExpressionError(
      `expected 5 space-separated fields (minute hour day-of-month month day-of-week), got ${fields.length}.`,
    );
  }

  for (let i = 0; i < fields.length; i++) {
    const [min, max] = FIELD_RANGES[i] as [number, number];
    if (!isValidCronField(fields[i] as string, min, max)) {
      throw new InvalidCronExpressionError(
        `field ${i + 1} ("${fields[i]}") is not valid for range [${min}, ${max}].`,
      );
    }
  }
}

/**
 * A recurring trigger that enqueues a Workflow execution on a UTC cron
 * schedule (no timezone support this release — see ADR-0006). Scheduling
 * infrastructure (BullMQ) is registered by the Application layer after this
 * entity validates successfully; Schedule itself is a plain, immutable value
 * holder like Workflow/Workspace.
 */
export class Schedule {
  readonly id: ScheduleId;
  readonly workflowId: WorkflowId;
  readonly workspaceId: WorkspaceId;
  readonly cronExpression: string;
  readonly createdAt: Date;

  private constructor(
    id: ScheduleId,
    workflowId: WorkflowId,
    workspaceId: WorkspaceId,
    cronExpression: string,
    createdAt: Date,
  ) {
    this.id = id;
    this.workflowId = workflowId;
    this.workspaceId = workspaceId;
    this.cronExpression = cronExpression;
    this.createdAt = createdAt;
  }

  static create(params: {
    id?: ScheduleId;
    workflowId: WorkflowId;
    workspaceId: WorkspaceId;
    cronExpression: string;
    createdAt?: Date;
  }): Schedule {
    const cronExpression = params.cronExpression.trim();
    if (cronExpression.length === 0) {
      throw new InvalidCronExpressionError('must not be empty.');
    }
    assertValidCron(cronExpression);

    return new Schedule(
      params.id ?? ScheduleId.generate(),
      params.workflowId,
      params.workspaceId,
      cronExpression,
      params.createdAt ?? new Date(),
    );
  }
}
