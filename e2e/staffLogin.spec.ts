import { test, expect } from '@playwright/test';

test.describe('Staff Login', () => {
  test('staff profile card grid loads and staff can log in with PIN', async ({ page }) => {
    await page.goto('/staff-login');

    // Wait for venues to load
    await expect(page.locator('text=Staff Login').first()).toBeVisible({ timeout: 10000 });

    // Select venue (click the first venue card)
    const venueCard = page.locator('button').filter({ hasText: /Little Green Door|KOKO/ }).first();
    await expect(venueCard).toBeVisible({ timeout: 10000 });
    await venueCard.click();

    // Wait for staff grid to appear
    await expect(page.locator('text=Tap your profile').first()).toBeVisible({ timeout: 10000 });

    // Staff profile cards should be visible
    const staffCards = page.locator('button').filter({ hasText: /Jake|Sofia|Marcus|Ella|Liam|Noah|Mia|Oscar|Freya|Emil/ });
    await expect(staffCards.first()).toBeVisible({ timeout: 10000 });

    // Click on a staff member
    await staffCards.first().click();

    // PIN entry form should appear
    await expect(page.locator('text=Enter your PIN')).toBeVisible({ timeout: 5000 });

    // Enter PIN
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/staff/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/\/staff\/dashboard/);
  });
});
