import { authorizedFetch } from './access-token-store';
import { API_BASE_URL } from './auth-api';
import type { WorkflowDto, WorkflowInputDto, WorkflowRunDto } from './workflow-dto';

/**
 * Every call goes through `authorizedFetch`, which attaches the in-memory access
 * token as a Bearer header and includes credentials so the httpOnly refresh
 * cookie is available for the one silent retry it performs on a 401.
 *
 * No call sends a workspace id: the API derives the tenant from the token, and a
 * client-supplied workspace would be ignored anyway.
 */
async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

export async function createWorkflow(input: WorkflowInputDto): Promise<WorkflowDto> {
  const response = await authorizedFetch(`${API_BASE_URL}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<WorkflowDto>(response);
}

export async function updateWorkflow(id: string, input: WorkflowInputDto): Promise<WorkflowDto> {
  const response = await authorizedFetch(`${API_BASE_URL}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<WorkflowDto>(response);
}

export async function executeWorkflow(id: string, payload: unknown): Promise<void> {
  const response = await authorizedFetch(`${API_BASE_URL}/webhooks/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await parseOrThrow<{ accepted: boolean }>(response);
}

export async function listWorkflowRuns(): Promise<WorkflowRunDto[]> {
  const response = await authorizedFetch(`${API_BASE_URL}/workflow-runs`);
  return parseOrThrow<WorkflowRunDto[]>(response);
}
