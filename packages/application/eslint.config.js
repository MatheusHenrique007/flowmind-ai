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
                'packages/application must stay free of infrastructure/framework imports — depend on Domain and its own ports only. See ADR-0001 Decision 2.',
            },
          ],
        },
      ],
    },
  },
];
