import base from '@flowmind/eslint-config';

export default [
  ...base,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/client',
                'prisma',
                'fastify',
                'bullmq',
                'ioredis',
                'redis',
                'openai',
                '@anthropic-ai/*',
                '@google/generative-ai',
                '@fastify/*',
              ],
              message:
                'packages/engine must depend only on Domain and contracts (AIProvider, Destination) — never on a vendor SDK or infra framework directly. See ADR-0002.',
            },
          ],
        },
      ],
    },
  },
];
