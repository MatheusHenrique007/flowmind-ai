export const DestinationKind = {
  SLACK: 'SLACK',
} as const;

export type DestinationKind = (typeof DestinationKind)[keyof typeof DestinationKind];
