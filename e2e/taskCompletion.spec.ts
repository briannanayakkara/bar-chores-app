import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Task Completion', () => {
  test('staff can view the tasks page', async ({ page }) => {
    await staffLogin(page);

    // Navigate to tasks
    await page.goto('/staff/tasks');

    // Wait for tasks page heading
    await expect(page.getByRole('heading', { name: "Today's Tasks" })).toBeVisible({ timeout: 15000 });

    // Page should show either tasks or empty state — both are valid
    const hasContent = await page.getByText(/Complete Task|Take Task|Claim Task|No tasks|Available Tasks|My Tasks/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });
});
