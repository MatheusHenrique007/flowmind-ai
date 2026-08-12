import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // workflow-management.spec.ts and run-history.spec.ts need a live API +
  // Postgres + Redis (see each spec's own header comment for the exact
  // manual invocation) — CI's e2e job (and this default config's webServer
  // below) only ever boots the web app on its own, with no backend, so both
  // specs are excluded from the default `playwright test` run and must be
  // run explicitly.
  testIgnore: process.env.FULL_STACK_E2E
    ? undefined
    : ['**/workflow-management.spec.ts', '**/run-history.spec.ts'],
  webServer: {
    command: 'pnpm start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:3100',
  },
});
