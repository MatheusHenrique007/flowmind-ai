import { authorizedFetch } from './access-token-store';
import { API_BASE_URL } from './auth-api';
import type { CreateScheduleInputDto, ScheduleDto } from './schedule-dto';

/**
 * Same authorizedFetch pattern as api-client.ts: every call carries the
 * in-memory access token, and no call sends a workspace id — the API always
 * derives the tenant from the token.
 */
async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

export async function createSchedule(input: CreateScheduleInputDto): Promise<ScheduleDto> {
  const response = await authorizedFetch(`${API_BASE_URL}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<ScheduleDto>(response);
}

export async function listSchedules(): Promise<ScheduleDto[]> {
  const response = await authorizedFetch(`${API_BASE_URL}/schedules`);
  return parseOrThrow<ScheduleDto[]>(response);
}

export async function deleteSchedule(id: string): Promise<void> {
  const response = await authorizedFetch(`${API_BASE_URL}/schedules/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed with status ${response.status}.`);
  }
}
