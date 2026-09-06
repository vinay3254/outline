import { test, expect } from '@playwright/test';

test('Cutline full editing and export workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Cutline editor' })).toBeVisible();

  await page.getByLabel('Import media').setInputFiles('public/fixtures/tiny.webm');
  await page.getByTestId('media-asset').dragTo(page.getByTestId('track-v1'));
  await page.keyboard.press('KeyS');
  await page.getByLabel('Filter').selectOption('monochrome');
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
});
