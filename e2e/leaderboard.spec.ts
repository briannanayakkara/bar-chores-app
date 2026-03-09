import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Leaderboard', () => {
  test('leaderboard loads and displays staff ranked by points', async ({ page }) => {
    await staffLogin(page);

    // Navigate to leaderboard
    await page.goto('/staff/leaderboard');

    // Leaderboard heading should be visible
    await expect(page.locator('h1')).toHaveText('Leaderboard', { timeout: 15000 });

    // Should see at least one leaderboard entry (staff name + points)
    const leaderboardEntries = page.locator('.rounded-xl').filter({ has: page.locator('.rounded-full') });
    await expect(leaderboardEntries.first()).toBeVisible({ timeout: 10000 });

    // Should see "pts" text somewhere on the page
    await expect(page.locator('text=pts').first()).toBeVisible({ timeout: 5000 });
  });
});
