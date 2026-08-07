export const StepType = {
  TRIGGER: 'TRIGGER',
  AI: 'AI',
  DESTINATION: 'DESTINATION',
} as const;

export type StepType = (typeof StepType)[keyof typeof StepType];
