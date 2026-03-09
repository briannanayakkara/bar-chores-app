import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Log in as staff via the profile card grid.
 * Uses the first available venue and first available staff member.
 * PIN defaults to '1234' (Jake's PIN in DEV seed data).
 */
export async function staffLogin(page: Page, pin = '1234') {
  await page.goto('/staff-login');

  // Wait for the staff login page to fully render
  await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('h1')).toHaveText('Staff Login');

  // Select the first venue card
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
  await page.locator('input[inputmode="numeric"]').fill(pin);
  await page.locator('button[type="submit"]').click();

  // Wait for dashboard
  await page.waitForURL('**/staff/dashboard', { timeout: 15000 });
}
