import { expect, test } from '@playwright/test';

test('changed vendor bank account requires independent human verification before release/signature', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Review ACME Components · PO-4821' })).toBeVisible();

  await page.getByRole('button', { name: 'Review document packet' }).click();

  await expect(page.getByText('DEMO FIXTURE MODE')).toBeVisible();
  await expect(page.getByText('Hard block · bank account changed')).toBeVisible();
  await expect(page.getByText('DE89 •••• •••• 0532')).toBeVisible();
  await expect(page.getByText('DE72 •••• •••• 5407')).toBeVisible();
  await expect(page.getByText('+49 30 555 0104')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare release packet with Foxit MCP' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Record independent verification' }).click();
  await expect(page.getByRole('button', { name: 'Prepare release packet with Foxit MCP' })).toBeVisible();
  await expect(page.getByText('human approved')).toBeVisible();

  await page.getByRole('button', { name: 'Prepare release packet with Foxit MCP' }).click();
  await expect(page.getByRole('button', { name: 'Send to human signer' })).toBeVisible();
  await expect(page.getByText('release prepared')).toBeVisible();

  await page.getByRole('button', { name: 'Send to human signer' }).click();
  await expect(page.getByRole('button', { name: 'Refresh authoritative signature status' })).toBeVisible();
  await expect(page.getByText('signature pending')).toBeVisible();

  await page.getByRole('button', { name: 'Refresh authoritative signature status' }).click();
  await expect(page.getByText('release authorized')).toBeVisible();
  await expect(page.getByText('Hash chain verified')).toBeVisible();
});
