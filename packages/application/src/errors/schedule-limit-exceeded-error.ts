import type { WorkspaceId } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

export const MAX_SCHEDULES_PER_WORKSPACE = 20;

export class ScheduleLimitExceededError extends ApplicationError {
  constructor(workspaceId: WorkspaceId) {
    super(
      `Workspace "${workspaceId.value}" already has ${MAX_SCHEDULES_PER_WORKSPACE} schedules, the maximum allowed.`,
    );
  }
}
