export const Provider = {
  CLAUDE: 'CLAUDE',
  OPENAI: 'OPENAI',
  GEMINI: 'GEMINI',
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];
