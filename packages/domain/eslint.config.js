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
                'packages/domain must stay pure — no infrastructure or framework imports. See ADR-0001 Decision 2.',
            },
          ],
        },
      ],
    },
  },
];
