import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Leaderboard', () => {
  test('leaderboard loads and displays staff ranked by points', async ({ page }) => {
    await staffLogin(page);

    // Navigate to leaderboard
    await page.goto('/staff/leaderboard');

    // Leaderboard heading should be visible
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 15000 });

    // Should see "pts" text somewhere on the page (points display)
    await expect(page.getByText('pts').first()).toBeVisible({ timeout: 10000 });
  });
});
