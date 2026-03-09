import { test, expect } from '@playwright/test';

test.describe('Staff Login', () => {
  test('staff profile card grid loads and staff can log in with PIN', async ({ page }) => {
    await page.goto('/staff-login');

    // Wait for the staff login page to fully render
    await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('h1')).toHaveText('Staff Login');

    // Select the first venue card (don't hardcode venue names)
    const venueCards = page.locator('button').filter({ has: page.locator('.rounded-full') });
    await expect(venueCards.first()).toBeVisible({ timeout: 15000 });
    await venueCards.first().click();

    // Wait for staff grid to appear
    await expect(page.locator('text=Tap your profile to sign in')).toBeVisible({ timeout: 15000 });

    // Click the first staff profile card
    const staffCards = page.locator('button.rounded-xl').filter({ has: page.locator('.rounded-full') });
    await expect(staffCards.first()).toBeVisible({ timeout: 10000 });
    await staffCards.first().click();

    // PIN entry form should appear
    await expect(page.locator('text=Enter your PIN')).toBeVisible({ timeout: 5000 });

    // Enter PIN and submit
    await page.locator('input[inputmode="numeric"]').fill('1234');
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard (may fail if PIN is wrong — that's expected for unknown seed data)
    await page.waitForURL('**/staff/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/\/staff\/dashboard/);
  });
});
