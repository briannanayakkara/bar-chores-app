import { test, expect } from '@playwright/test';

test.describe('Create Staff', () => {
  test('admin creates a new staff user who appears in the users list', async ({ page }) => {
    // Login as admin first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'brian@rekom.dk');
    await page.fill('input[type="password"]', 'Admin1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // Navigate to users page
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Click "Add Staff" button
    const addButton = page.locator('button').filter({ hasText: /Add Staff|New Staff|Create Staff/ });
    await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    await addButton.first().click();

    // Fill in the new staff form
    const uniqueName = `E2E Test ${Date.now().toString().slice(-6)}`;
    const uniqueUsername = `e2e-test-${Date.now().toString().slice(-6)}`;

    await page.fill('input[placeholder*="name" i]', uniqueName);
    await page.fill('input[placeholder*="username" i]', uniqueUsername);
    await page.fill('input[placeholder*="pin" i]', '9876');

    // Submit the form
    const submitBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /Create|Save|Add/ })
    );
    await submitBtn.first().click();

    // Verify the new staff member appears in the list
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 15000 });
  });
});
