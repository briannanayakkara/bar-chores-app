import { test, expect } from '@playwright/test';
import { staffLogin } from './helpers';

test.describe('Staff Login', () => {
  test('staff profile card grid loads and staff can log in with PIN', async ({ page }) => {
    await staffLogin(page);
    await expect(page).toHaveURL(/\/staff\/dashboard/);
  });
});
