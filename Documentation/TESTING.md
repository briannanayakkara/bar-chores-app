# Testing Guide — Bar Chores App

## Overview

The app uses four testing layers:

| Layer | Tool | Location | What it covers |
|-------|------|----------|----------------|
| **Unit** | Vitest | `src/tests/unit/` | Pure business logic — points calculation, reward validation, PIN rules, task completion, code generation, utilities |
| **Integration** | Vitest + Supabase | `src/tests/integration/` | RLS policies, database triggers, reward reservation flow, staff auth Edge Function, task completion flow |
| **E2E** | Playwright | `e2e/` | Full user journeys — admin login, staff login, create staff, task completion, leaderboard, reward request |
| **Coverage** | @vitest/coverage-v8 | `coverage/` | V8 code coverage reports |

---

## Running Tests Locally

```bash
# Unit tests only (fast, ~2s)
npm run test:unit

# Integration tests (requires DEV Supabase credentials)
DEV_SUPABASE_SERVICE_ROLE_KEY=your_key npm run test:integration

# E2E tests (auto-starts dev server via Playwright)
npm run test:e2e

# E2E with visual UI
npm run test:e2e:ui

# All tests (unit + integration)
npm run test

# Full suite including E2E
npm run test:all

# Coverage report
npm run test:coverage

# Watch mode (re-runs on file change)
npm run test:watch

# Visual test UI
npm run test:ui
```

---

## Adding a New Unit Test

Unit tests go in `src/tests/unit/` with `.test.ts` extension.

### Worked Example

Create `src/tests/unit/myFeature.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Define the logic you're testing (or import from src/lib/)
function calculateDiscount(points: number): number {
  if (points >= 1000) return 20;
  if (points >= 500) return 10;
  return 0;
}

describe('Discount Calculation', () => {
  it('returns 20% for 1000+ points', () => {
    expect(calculateDiscount(1000)).toBe(20);
    expect(calculateDiscount(1500)).toBe(20);
  });

  it('returns 10% for 500-999 points', () => {
    expect(calculateDiscount(500)).toBe(10);
    expect(calculateDiscount(999)).toBe(10);
  });

  it('returns 0% for under 500 points', () => {
    expect(calculateDiscount(499)).toBe(0);
    expect(calculateDiscount(0)).toBe(0);
  });
});
```

Run it:
```bash
npm run test:unit
```

---

## Adding a New Integration Test

Integration tests go in `src/tests/integration/` with `.test.ts` extension.

### Worked Example

Create `src/tests/integration/myFeature.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('My Feature', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await seedTestVenue();
    // ctx gives you: client, venue, admin, staff1, staff2
  }, 30000);

  afterAll(async () => {
    await ctx?.cleanup(); // Always clean up!
  }, 30000);

  it('does something against Supabase', async () => {
    const { client, staff1, venue } = ctx;

    // Use the service client to insert/read/update data
    const { data } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(data?.points_total).toBe(0);
  }, 15000);
});
```

Key rules:
- **Always use `seedTestVenue()`** to create isolated test data
- **Always call `cleanup()`** in `afterAll` to remove test data
- **Use `describe.skipIf`** to skip gracefully when credentials aren't available
- **Set generous timeouts** (15-30s) for network operations

---

## Adding a New E2E Test

E2E tests go in `e2e/` with `.spec.ts` extension.

### Worked Example

Create `e2e/myJourney.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My User Journey', () => {
  test('user can do something', async ({ page }) => {
    await page.goto('/login');

    // Fill form
    await page.fill('input[type="email"]', 'brian@rekom.dk');
    await page.fill('input[type="password"]', 'Admin1234!');
    await page.click('button[type="submit"]');

    // Assert navigation
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Assert content
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
```

Run it:
```bash
npm run test:e2e
```

---

## What Must Pass Before a PR Can Be Merged

All of the following must pass in the GitHub Actions CI pipeline:

1. TypeScript type check (`npx tsc -b`)
2. Unit tests (`npm run test:unit`)
3. Integration tests (`npm run test:integration`)
4. E2E tests (`npm run test:e2e`)

If any step fails, the deployment is blocked.

---

## DEV Supabase Credentials for Integration Tests

Integration tests run against the **DEV** Supabase project (never production):

| Variable | Value | Where to find |
|----------|-------|---------------|
| `DEV_SUPABASE_URL` | `https://drwflvxdvwtjzuqxfort.supabase.co` | `docs/architecture/environments.md` |
| `DEV_SUPABASE_SERVICE_ROLE_KEY` | Stored in `.env.development` | Supabase dashboard → Settings → API |
| `DEV_SUPABASE_ANON_KEY` | `sb_publishable_LUrHfqbbHN01DUcvXPheng_TEsRBMQg` | `docs/architecture/environments.md` |

In CI, these are set as GitHub Actions secrets:
- `DEV_SUPABASE_URL`
- `DEV_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Debugging a Failing Test

### Unit Test Failures

```bash
# Run the specific failing test file
npx vitest run src/tests/unit/points.test.ts

# Run in watch mode for rapid iteration
npx vitest src/tests/unit/points.test.ts
```

Look for:
- Incorrect expected values
- Missing imports
- Logic changes that weren't reflected in tests

### Integration Test Failures

```bash
# Run with verbose logging
DEV_SUPABASE_SERVICE_ROLE_KEY=your_key npx vitest run src/tests/integration/rls.test.ts
```

Common causes:
- Missing `DEV_SUPABASE_SERVICE_ROLE_KEY` environment variable
- DEV Supabase project is down or has schema changes
- RLS policies changed — update tests to match
- Test cleanup didn't run (leftover data from previous run)

### E2E Test Failures

```bash
# Run with headed browser (see what's happening)
npx playwright test --headed

# Run specific test
npx playwright test e2e/adminLogin.spec.ts

# Debug mode (step through)
npx playwright test --debug

# View trace after failure
npx playwright show-trace test-results/*/trace.zip
```

Common causes:
- Dev server not running (Playwright auto-starts it, but check logs)
- Selectors changed (button text, input types)
- Timing issues — increase `timeout` values
- Seed data not present — run the seed script first

---

## Updating Test Seed Data

Integration tests use `seedTestVenue()` from `src/tests/helpers/testSetup.ts`. This creates:
- 1 test venue with unique slug
- 1 venue admin
- 2 staff members (PINs: `1001` and `1002`)

To modify the seed data, edit `testSetup.ts`. Key points:
- Each test suite gets its own isolated venue (no cross-contamination)
- `cleanup()` removes all data in FK order
- Staff PINs are bcrypt-hashed on creation

For the DEV environment seed data (used by E2E tests), see `docs/api/seed-data.md` and run:
```bash
node scripts/seed-reset.mjs
```

---

## Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Business logic utilities (`src/lib/`) | 90% | Run `npm run test:coverage` to check |
| Supabase integration functions | 80% | Measured via integration tests |
| React components | 60% | Not yet fully covered |
