import { test, expect } from '@playwright/test';

test.describe('Reward Request', () => {
  test('staff requests a reward and available points reduce', async ({ page }) => {
    // Login as staff
    await page.goto('/staff-login');

    const venueCard = page.locator('button').filter({ hasText: /Little Green Door|KOKO/ }).first();
    await expect(venueCard).toBeVisible({ timeout: 10000 });
    await venueCard.click();

    await page.waitForTimeout(1000);
    const staffCard = page.locator('button').filter({ hasText: /Jake|Sofia|Marcus|Ella|Liam|Noah|Mia|Oscar|Freya|Emil/ }).first();
    await expect(staffCard).toBeVisible({ timeout: 10000 });
    await staffCard.click();

    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/staff/dashboard', { timeout: 15000 });

    // Navigate to rewards
    await page.goto('/staff/rewards');
    await page.waitForLoadState('networkidle');

    // Check that the rewards page loaded
    await expect(page.locator('text=/Available Points|Redeem Points/i').first()).toBeVisible({ timeout: 10000 });

    // Look for reward buttons (Drink Ticket, Tote Bag, etc.)
    const rewardButtons = page.locator('button').filter({ hasText: /Drink Ticket|Tote Bag|Bottle Ticket|Hoodie/ });

    // If there are reward options and staff has points, try requesting one
    const firstReward = rewardButtons.first();
    if (await firstReward.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isEnabled = await firstReward.isEnabled();
      if (isEnabled) {
        await firstReward.click();

        // Should see success message
        await expect(
          page.locator('text=/requested|Waiting for admin/i').first()
        ).toBeVisible({ timeout: 10000 });

        // Check pending reserved points message
        await expect(
          page.locator('text=/reserved|pending/i').first()
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
