/**
 * Plain DTOs mirroring the API's request/response shape for workflows.
 * Deliberately not imported from any @flowmind/* package — the frontend
 * never sees Domain entities, only these types and the Nodes/Edges React
 * Flow itself works with.
 */
export type AIProviderName = 'CLAUDE' | 'OPENAI' | 'GEMINI';
export type DestinationName = 'SLACK';

export interface TriggerStepDto {
  type: 'TRIGGER';
  kind: 'webhook';
}

export interface AIStepDto {
  type: 'AI';
  provider: AIProviderName;
  instruction: string;
}

export interface DestinationStepDto {
  type: 'DESTINATION';
  destination: DestinationName;
  target: string;
}

export type WorkflowStepDto = TriggerStepDto | AIStepDto | DestinationStepDto;

export interface WorkflowInputDto {
  name: string;
  steps: WorkflowStepDto[];
}

export interface WorkflowDto {
  id: string;
  name: string;
  /** Only present on the GET /workflows/:id detail response, not on create/update. */
  steps?: WorkflowStepDto[];
}

/** Most-recently-started run for a workflow, or null if it has never been executed. */
export interface LastRunDto {
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  finishedAt?: string;
}

/** Lightweight shape returned by GET /workflows — no steps. */
export interface WorkflowSummaryDto {
  id: string;
  name: string;
  lastRun?: LastRunDto | null;
}

export interface WorkflowStepResultDto {
  stepId: string;
  status: 'SUCCEEDED' | 'FAILED';
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface WorkflowRunDto {
  id: string;
  workflowId: string;
  /** Resolved server-side from the owning Workflow; absent if it could no longer be found. */
  workflowName?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  startedAt?: string;
  finishedAt?: string;
  stepResults: WorkflowStepResultDto[];
}
