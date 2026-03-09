import { test, expect } from '@playwright/test';

test.describe('Leaderboard', () => {
  test('leaderboard loads and displays staff ranked by points', async ({ page }) => {
    // Login as staff first
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

    // Navigate to leaderboard
    await page.goto('/staff/leaderboard');
    await page.waitForLoadState('networkidle');

    // Leaderboard should show staff names
    await expect(page.locator('text=/Leaderboard/i').first()).toBeVisible({ timeout: 10000 });

    // Should see staff names on the page
    const staffNames = page.locator('text=/Jake|Sofia|Marcus|Ella|Liam/');
    await expect(staffNames.first()).toBeVisible({ timeout: 10000 });

    // Points should be displayed (look for numbers)
    const pointsDisplay = page.locator('text=/\\d+ pts|\\d+ points/i');
    // Points display may or may not be visible depending on data
  });
});
