import { z } from 'zod';

/**
 * Validates and exposes process.env in a typed, fail-fast manner.
 * Extend this schema as new environment variables are introduced.
 *
 * DATABASE_URL/REDIS_URL are required — the app cannot boot without them.
 * ANTHROPIC_API_KEY/OPENAI_API_KEY/GEMINI_API_KEY/SLACK_BOT_TOKEN are all
 * optional: the server boots and GET /health reports them as
 * "not_configured" rather than crashing, so a fresh clone is runnable in
 * minutes even before real credentials exist. When an AI provider's key is
 * absent, the composition root substitutes MockAIProvider for that provider
 * (see docs/adr/0005-provider-selection-strategy.md) instead of failing.
 *
 * ACCESS_TOKEN_SECRET has a development default so a fresh clone still boots,
 * but production is rejected below if it is left at that value — an
 * accidentally-shipped default signing key makes every access token forgeable.
 */
const DEV_ACCESS_TOKEN_SECRET = 'dev-only-insecure-access-token-secret-change-me';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().default(''),
    OPENAI_API_KEY: z.string().default(''),
    GEMINI_API_KEY: z.string().default(''),
    SLACK_BOT_TOKEN: z.string().default(''),
    /** HS256 signing key for the 15-minute access token (ADR-0003). */
    ACCESS_TOKEN_SECRET: z.string().min(32).default(DEV_ACCESS_TOKEN_SECRET),
    /** Access token lifetime, as a `jose` duration string. */
    ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
    /** Refresh token / refresh cookie lifetime, in days. */
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /**
     * Comma-separated CORS allow-list. Replaces this project's previous
     * `origin: true` (reflect-any), which cannot be combined with the
     * credentialed refresh cookie (PRD v0.4.0).
     */
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.ACCESS_TOKEN_SECRET === DEV_ACCESS_TOKEN_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ACCESS_TOKEN_SECRET'],
        message: 'ACCESS_TOKEN_SECRET must be set to a real secret when NODE_ENV=production.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

/** The allow-list as a list — parsed once here rather than in every request. */
export function allowedOrigins(env: Env): string[] {
  return env.WEB_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
