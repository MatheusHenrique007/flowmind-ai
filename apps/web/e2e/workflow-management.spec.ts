import { expect, test } from '@playwright/test';

/**
 * Full workflow-management flow against a REAL running stack (API + Postgres
 * + Redis) — unlike home.spec.ts, which deliberately runs with no backend.
 * This spec is not wired into `pnpm --filter @flowmind/web test:e2e`'s
 * default CI invocation because it needs `apps/api` to be running against a
 * real Postgres/Redis first (see the release's PRD for the exact commands);
 * run it manually with:
 *
 *   docker compose up -d
 *   pnpm --filter @flowmind/api dev            # in one terminal
 *   pnpm --filter @flowmind/web exec playwright test e2e/workflow-management.spec.ts
 *
 * Each run registers a fresh, uniquely-emailed user so it never collides with
 * a previous run's data (there is no test-only reset endpoint).
 */
test('create, list, reopen, edit and persist a workflow', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'correct horse battery staple';

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'My Workflows' })).toBeVisible();
  await expect(page.getByText('You have not created any workflows yet.')).toBeVisible();

  // --- Create Workflow A ---
  await page.getByRole('link', { name: 'New Workflow' }).click();
  await expect(page).toHaveURL(/\/workflows\/new$/);

  await page.getByPlaceholder('Workflow name').fill('Workflow A');
  await page.getByLabel('Instruction').fill('Summarize A.');
  await page.getByLabel('Target').fill('#a-channel');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Workflow A' })).toBeVisible();

  // --- Create Workflow B ---
  await page.getByRole('link', { name: 'New Workflow' }).click();
  await page.getByPlaceholder('Workflow name').fill('Workflow B');
  await page.getByLabel('Instruction').fill('Summarize B.');
  await page.getByLabel('Target').fill('#b-channel');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Workflow A' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Workflow B' })).toBeVisible();

  // --- Open A: confirm the reconstructed editor shows the 3 nodes with A's saved data ---
  await page.getByRole('link', { name: 'Workflow A' }).click();
  await expect(page).toHaveURL(/\/workflows\/[^/]+$/);
  await expect(page.getByPlaceholder('Workflow name')).toHaveValue('Workflow A');
  await expect(page.getByLabel('Instruction')).toHaveValue('Summarize A.');
  await expect(page.getByLabel('Target')).toHaveValue('#a-channel');
  await expect(page.getByText('Trigger', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('AI Step')).toBeVisible();
  await expect(page.getByText('Destination', { exact: false }).first()).toBeVisible();

  const editUrl = page.url();

  // --- Edit A: change the AI instruction text and save ---
  await page.getByLabel('Instruction').fill('Summarize A, revised.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/$/);

  // --- Reload the reopened workflow's page and confirm the edit persisted ---
  await page.goto(editUrl);
  await expect(page.getByLabel('Instruction')).toHaveValue('Summarize A, revised.');
  await expect(page.getByPlaceholder('Workflow name')).toHaveValue('Workflow A');
});
