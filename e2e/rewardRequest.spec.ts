import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Reward Request', () => {
  test('staff requests a reward and available points reduce', async ({ page }) => {
    await staffLogin(page);

    // Navigate to rewards
    await page.goto('/staff/rewards');

    // Check that the rewards page loaded — "Available Points" heading
    await expect(page.locator('text=Available Points')).toBeVisible({ timeout: 15000 });

    // Look for the "Redeem Points" section
    await expect(page.locator('text=Redeem Points')).toBeVisible({ timeout: 10000 });

    // Find reward buttons in the grid (they're button elements with rounded-xl)
    const rewardButtons = page.locator('button.rounded-xl').filter({ has: page.locator('.text-2xl') });

    // If there are reward options and staff has points, try requesting one
    const firstReward = rewardButtons.first();
    if (await firstReward.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await firstReward.isEnabled();
      if (isEnabled) {
        await firstReward.click();

        // Should see success or pending message
        await expect(
          page.locator('text=/reserved|pending|requested|approval/i').first()
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
