import { z } from 'zod';

/**
 * Validates and exposes process.env in a typed, fail-fast manner.
 * Extend this schema as new environment variables are introduced.
 *
 * DATABASE_URL/REDIS_URL are required — the app cannot boot without them.
 * ANTHROPIC_API_KEY/SLACK_BOT_TOKEN are optional: the server boots and
 * GET /health reports them as "not_configured" rather than crashing, so a
 * fresh clone is runnable in minutes even before real credentials exist.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().default(''),
  SLACK_BOT_TOKEN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
