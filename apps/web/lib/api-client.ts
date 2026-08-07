import type { WorkflowDto, WorkflowInputDto, WorkflowRunDto } from './workflow-dto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

export async function createWorkflow(input: WorkflowInputDto): Promise<WorkflowDto> {
  const response = await fetch(`${API_BASE_URL}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<WorkflowDto>(response);
}

export async function updateWorkflow(id: string, input: WorkflowInputDto): Promise<WorkflowDto> {
  const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<WorkflowDto>(response);
}

export async function executeWorkflow(id: string, payload: unknown): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/webhooks/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await parseOrThrow<{ accepted: boolean }>(response);
}

export async function listWorkflowRuns(): Promise<WorkflowRunDto[]> {
  const response = await fetch(`${API_BASE_URL}/workflow-runs`);
  return parseOrThrow<WorkflowRunDto[]>(response);
}
