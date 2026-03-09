# Testing Patterns Skill

Triggers when writing or running tests.

## Test Stack

- **Vitest** — configured in `vite.config.ts` with jsdom environment
- **@testing-library/react** — component testing
- **@testing-library/jest-dom** — DOM matchers (loaded via `src/tests/setup.ts`)
- **Playwright** — E2E testing (configured in `playwright.config.ts`)
- **@vitest/coverage-v8** — code coverage

## Test Structure

```
src/tests/
  setup.ts                      # Vitest setup (jest-dom matchers)
  unit/                         # Pure business logic tests
  integration/                  # DEV Supabase integration tests
  helpers/
    testSetup.ts                # seedTestVenue(), getAuthenticatedClient()
e2e/                            # Playwright E2E tests
```

## Scripts

```bash
npm run test:unit           # Unit tests only (~2s)
npm run test:integration    # Integration tests (needs DEV_SUPABASE_SERVICE_ROLE_KEY)
npm run test:e2e            # Playwright E2E (starts dev server automatically)
npm run test:coverage       # Coverage report (V8 provider)
npm run test:all            # Unit + integration + E2E
npm run test:watch          # Vitest in watch mode
npm run test:ui             # Vitest visual UI
```

## Test File Conventions

- Unit tests: `src/tests/unit/*.test.ts`
- Integration tests: `src/tests/integration/*.test.ts`
- E2E tests: `e2e/*.spec.ts`
- Use `describe/it/expect` from vitest
- Integration tests use `describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)` to skip gracefully without credentials

## Patterns

### Unit Test (Pure Logic)
```ts
import { describe, it, expect } from 'vitest';

describe('Business Logic', () => {
  it('calculates correctly', () => {
    expect(calculate(100, 50)).toBe(50);
  });
});
```

### Integration Test (Supabase)
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('Feature', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await seedTestVenue(); }, 30000);
  afterAll(async () => { await ctx?.cleanup(); }, 30000);

  it('does something', async () => {
    // Use ctx.client, ctx.venue, ctx.admin, ctx.staff1, ctx.staff2
  });
});
```

### E2E Test (Playwright)
```ts
import { test, expect } from '@playwright/test';

test('user journey', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
});
```

### Mocking Supabase (Unit Tests)
```ts
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}))
```

## Coverage Targets

- Business logic utilities: 90%
- Supabase integration functions: 80%
- React components: 60%
