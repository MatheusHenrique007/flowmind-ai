import { expect, test } from '@playwright/test';

/**
 * The editor is behind authentication since v0.4.0, and this suite runs the
 * frontend on its own (no API, no database — see playwright.config.ts), so the
 * only thing it can assert about `/` is the redirect. The editor's own rendering
 * stays covered by the unit/integration layers; a full signed-in browser flow
 * needs the API and Postgres running and is the manual demo script's job
 * (docs/prd/v0.4.0-multi-tenant-auth.md).
 */
test('an unauthenticated visitor is redirected from the editor to sign in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('the sign-in page links to registration, which asks for an email and password', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create one' }).click();

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
