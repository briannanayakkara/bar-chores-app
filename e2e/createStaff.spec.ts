import { test, expect } from '@playwright/test';

test.describe('Create Staff', () => {
  test('admin creates a new staff user who appears in the users list', async ({ page }) => {
    // Login as admin first
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible({ timeout: 30000 });

    await page.locator('input[type="email"]').fill('brian@rekom.dk');
    await page.locator('input[type="password"]').fill('Admin1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // Navigate to users page
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 15000 });

    // Click "Add Staff" button
    const addButton = page.locator('button').filter({ hasText: /Add Staff/ });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // Fill in the new staff form
    const uniqueName = `E2E Test ${Date.now().toString().slice(-6)}`;
    const uniqueUsername = `e2e_${Date.now().toString().slice(-6)}`;

    await page.locator('input[placeholder="Jake B"]').fill(uniqueName);
    await page.locator('input[placeholder="jake_b"]').fill(uniqueUsername);
    await page.locator('input[placeholder="1234"]').fill('9876');

    // Submit the form
    const createBtn = page.locator('button').filter({ hasText: 'Create' });
    await createBtn.click();

    // Verify the new staff member appears in the list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 15000 });
  });
});
