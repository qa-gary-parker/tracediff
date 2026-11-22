import { test, expect } from '@playwright/test';
import { ORIGIN, serveApp } from '../app';

test('save profile', async ({ page }) => {
  await serveApp(page, 200);
  await page.goto(ORIGIN);
  await page.locator('#name').fill('Ada');
  await page.waitForTimeout(50);
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Saved');
});
