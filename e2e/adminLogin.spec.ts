import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('admin logs in with email and password and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill in email and password
    await page.fill('input[type="email"]', 'brian@rekom.dk');
    await page.fill('input[type="password"]', 'Admin1234!');

    // Click sign in button
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Dashboard content should be visible
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  });
});
