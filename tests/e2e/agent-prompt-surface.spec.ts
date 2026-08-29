import { expect, test } from '@playwright/test';

test('Foxit challenge flow visibly starts from a bounded plain prompt', async ({ page }) => {
  await page.goto('/');

  const prompt = page.getByLabel('Agent prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveValue(/Review the ACME Components packet for PO-4821/);
  await expect(page.getByText('read · extract · prepare · request human signature')).toBeVisible();
  await expect(page.getByText(/cannot sign, approve verification, authorize payment/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run bounded agent' })).toBeEnabled();
});
