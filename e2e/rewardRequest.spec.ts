import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Reward Request', () => {
  test('staff can view the rewards page', async ({ page }) => {
    await staffLogin(page);

    // Navigate to rewards
    await page.goto('/staff/rewards');

    // Check that the rewards page loaded
    await expect(page.getByText('Available Points')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Redeem Points')).toBeVisible({ timeout: 10000 });
  });
});
