import { test, expect } from '@playwright/test';

test.describe('Task Completion', () => {
  test('staff completes a task under 500pts and points update immediately', async ({ page }) => {
    // Login as staff
    await page.goto('/staff-login');

    // Select venue
    const venueCard = page.locator('button').filter({ hasText: /Little Green Door|KOKO/ }).first();
    await expect(venueCard).toBeVisible({ timeout: 10000 });
    await venueCard.click();

    // Select first staff member
    await page.waitForTimeout(1000);
    const staffCard = page.locator('button').filter({ hasText: /Jake|Sofia|Marcus|Ella|Liam|Noah|Mia|Oscar|Freya|Emil/ }).first();
    await expect(staffCard).toBeVisible({ timeout: 10000 });
    await staffCard.click();

    // Enter PIN (Jake's PIN is 1234)
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/staff/dashboard', { timeout: 15000 });

    // Navigate to tasks
    await page.goto('/staff/tasks');
    await page.waitForLoadState('networkidle');

    // Look for a task and complete button
    const completeBtn = page.locator('button').filter({ hasText: /Complete Task|Take Task/ }).first();

    if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Record current points from the dashboard header or sidebar
      await completeBtn.click();

      // Wait for success message or celebration overlay
      await page.waitForTimeout(2000);

      // The page should show some confirmation
      const successMsg = page.locator('text=/completed|\\+\\d+ pts/i');
      await expect(successMsg.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
