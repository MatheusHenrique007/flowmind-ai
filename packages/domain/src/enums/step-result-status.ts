export const StepResultStatus = {
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export type StepResultStatus = (typeof StepResultStatus)[keyof typeof StepResultStatus];
