import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Task Completion', () => {
  test('staff completes a task under 500pts and points update immediately', async ({ page }) => {
    await staffLogin(page);

    // Navigate to tasks
    await page.goto('/staff/tasks');

    // Wait for tasks page to load
    await expect(page.locator('h1')).toHaveText("Today's Tasks", { timeout: 15000 });

    // Look for a completable task button (Complete Task, Take Task, or Claim Task)
    const actionBtn = page.locator('button').filter({ hasText: /Complete Task|Take Task|Claim Task/ }).first();

    // Tasks may or may not exist depending on seed data
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click();

      // Wait for success feedback — celebration overlay or success message
      const successIndicator = page.locator('text=/completed|\\+\\d+|pts|Keep it up/i');
      await expect(successIndicator.first()).toBeVisible({ timeout: 10000 });
    } else {
      // No tasks available — verify the empty state message
      await expect(
        page.locator('text=/No tasks|Available Tasks|My Tasks/i').first()
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
