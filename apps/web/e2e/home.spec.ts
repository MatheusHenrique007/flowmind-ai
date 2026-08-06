import { expect, test } from '@playwright/test';

test('homepage shows the FlowMind AI title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('FlowMind AI')).toBeVisible();
});
