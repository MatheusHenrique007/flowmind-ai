/**
 * Plain DTOs mirroring the API's /schedules request/response shape.
 * cronExpression is always interpreted in UTC this release — no timezone
 * field exists anywhere on this DTO (see ADR-0006).
 */
export interface CreateScheduleInputDto {
  workflowId: string;
  cronExpression: string;
}

export interface ScheduleDto {
  id: string;
  workflowId: string;
  workspaceId: string;
  cronExpression: string;
  createdAt: string;
  nextRunAt: string | null;
}
