import { test, expect } from '@playwright/test';
import { ORIGIN, serveApp } from '../app';

test('save profile', async ({ page }) => {
  await serveApp(page, 500);
  await page.goto(ORIGIN);
  await page.locator('#name').fill('Ada');
  await page.waitForTimeout(600);
  await page.locator('#save-btn').click({ timeout: 1000 });
  await expect(page.locator('#status')).toHaveText('Saved');
});
