import { expect, test } from '@playwright/test';

test('homepage renders the visual workflow editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Trigger')).toBeVisible();
  await expect(page.getByText('AI Step')).toBeVisible();
  await expect(page.getByText('Destination').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute' })).toBeVisible();
});
