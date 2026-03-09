import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('admin logs in with email and password and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');

    // Wait for the login page to fully render
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible({ timeout: 30000 });

    // Fill in email and password
    await page.locator('input[type="email"]').fill('brian@rekom.dk');
    await page.locator('input[type="password"]').fill('Admin1234!');

    // Click sign in button
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Dashboard heading should be visible (use getByRole to avoid multiple h1 matches)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  });
});
