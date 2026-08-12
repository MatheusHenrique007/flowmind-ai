import { expect, test } from '@playwright/test';

/**
 * Full run-history flow against a REAL running stack (API + Postgres +
 * Redis + Worker) — same convention as workflow-management.spec.ts (v0.7.0):
 * not wired into the default `playwright test` run because it needs a real
 * backend, and only enabled when FULL_STACK_E2E is set (see
 * playwright.config.ts). Run it manually with:
 *
 *   docker compose up -d
 *   pnpm --filter @flowmind/api dev            # in one terminal (no
 *                                                 ANTHROPIC_API_KEY set, so
 *                                                 MockAIProvider is used)
 *   FULL_STACK_E2E=1 pnpm --filter @flowmind/web exec playwright test e2e/run-history.spec.ts
 *
 * Each run registers fresh, uniquely-emailed users so it never collides with
 * a previous run's data (there is no test-only reset endpoint).
 */
test('execute a workflow, watch it run, and inspect its history', async ({ page }) => {
  const email = `e2e-run-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'correct horse battery staple';

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  // --- Create a workflow ---
  await page.getByRole('link', { name: 'New Workflow' }).click();
  await page.getByPlaceholder('Workflow name').fill('Run History Workflow');
  await page.getByLabel('Instruction').fill('Summarize the ticket.');
  await page.getByLabel('Target').fill('#support');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Fresh workflow: no runs yet.
  await expect(page.getByText('No runs yet')).toBeVisible();

  // --- Open it and execute ---
  await page.getByRole('link', { name: 'Run History Workflow' }).click();
  await expect(page).toHaveURL(/\/workflows\/[^/]+$/);

  await expect(page.getByText('No runs yet — click Execute above')).toBeVisible();

  await page.getByRole('button', { name: 'Execute' }).click();

  // RUNNING is shown at some point during the poll (may be brief with MockAIProvider).
  await expect(page.getByText(/Starting the run…|Run is RUNNING…/)).toBeVisible({
    timeout: 10_000,
  });

  // Terminal state, reached via polling (bounded at 75s in lib/run-polling.ts).
  await expect(page.getByText(/Run succeeded|Run finished as/)).toBeVisible({ timeout: 80_000 });

  // The history panel should now show exactly one run, and no longer the empty state.
  await expect(page.getByText('No runs yet — click Execute above')).toHaveCount(0);
  const runRow = page.getByRole('button', { name: /SUCCEEDED|FAILED/ }).first();
  await expect(runRow).toBeVisible();

  // --- Expand the run to see step detail ---
  await runRow.click();
  await expect(page.getByText(/step.*recorded/)).toBeVisible();

  // Back on "/", the last-run indicator should reflect the same outcome.
  await page.getByRole('button', { name: /My Workflows/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Last run succeeded|Last run failed/)).toBeVisible();
});

test("a second user cannot see the first user's workflow or its runs", async ({ page }) => {
  const ownerEmail = `e2e-owner-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const outsiderEmail = `e2e-outsider-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'correct horse battery staple';

  await page.goto('/register');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: 'New Workflow' }).click();
  await page.getByPlaceholder('Workflow name').fill('Owner Only Workflow');
  await page.getByLabel('Instruction').fill('Summarize.');
  await page.getByLabel('Target').fill('#owner');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: 'Owner Only Workflow' }).click();
  await expect(page).toHaveURL(/\/workflows\/[^/]+$/);
  const ownerWorkflowUrl = page.url();

  await page.getByRole('button', { name: 'Execute' }).click();
  await expect(page.getByText(/Run succeeded|Run finished as/)).toBeVisible({ timeout: 80_000 });

  // Log out and register a completely different user.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/register');
  await page.getByLabel('Email').fill(outsiderEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  // The outsider's own list has no workflows — the owner's run is invisible.
  await expect(page.getByText('You have not created any workflows yet.')).toBeVisible();
  await expect(page.getByText('Owner Only Workflow')).toHaveCount(0);

  // Navigating straight to the owner's workflow URL does not leak its data
  // (GetWorkflow/ListWorkflowRuns are workspace-scoped — 404-shaped, not 403).
  await page.goto(ownerWorkflowUrl);
  await expect(page.getByPlaceholder('Workflow name')).not.toHaveValue('Owner Only Workflow');
});
