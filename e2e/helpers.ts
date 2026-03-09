import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Log in as staff via the profile card grid.
 * Uses the first available venue and first available staff member.
 * PIN defaults to '1234' (Jake's PIN in DEV seed data).
 */
export async function staffLogin(page: Page, pin = '1234') {
  await page.goto('/staff-login');

  // Wait for the staff login heading to render
  await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible({ timeout: 30000 });

  // Select the first venue card (buttons with min-h-[120px] in the venue grid)
  const venueCard = page.locator('button.min-h-\\[120px\\]').first();
  await expect(venueCard).toBeVisible({ timeout: 15000 });
  await venueCard.click();

  // Wait for staff grid — "Tap your profile to sign in"
  await expect(page.getByText('Tap your profile to sign in')).toBeVisible({ timeout: 15000 });

  // Click the first staff profile card
  const staffCard = page.locator('button.min-h-\\[120px\\]').first();
  await expect(staffCard).toBeVisible({ timeout: 10000 });
  await staffCard.click();

  // PIN entry form should appear
  await expect(page.getByText('Enter your PIN')).toBeVisible({ timeout: 10000 });

  // Enter PIN and submit
  await page.locator('input[type="password"]').fill(pin);
  await page.locator('button[type="submit"]').click();

  // Wait for dashboard
  await page.waitForURL('**/staff/dashboard', { timeout: 15000 });
}
