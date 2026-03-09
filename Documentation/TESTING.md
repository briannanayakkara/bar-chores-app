# Testing Guide — Bar Chores App

## Overview

The app uses **unit tests only** — pure business logic tests with no database or network dependencies.

| Layer | Tool | Location | What it covers |
|-------|------|----------|----------------|
| **Unit** | Vitest | `src/tests/unit/` | Pure business logic — points calculation, reward validation, PIN rules, task completion, code generation, utilities |
| **Coverage** | @vitest/coverage-v8 | `coverage/` | V8 code coverage reports |

> **Why no E2E or integration tests?** E2E and integration tests were removed because they required live database connections in CI, which made them fragile and slow. All business logic is tested via fast, deterministic unit tests instead.

---

## Running Tests Locally

```bash
# Unit tests only (fast, ~2s)
npm run test:unit

# All tests
npm run test

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

## Current Test Files (53 tests)

| File | Tests | What it covers |
|------|-------|----------------|
| `color.test.ts` | 8 | `hexToRgb()`, `DEFAULT_COLORS`, `DEFAULT_RGB` |
| `date.test.ts` | 6 | `getLocalDate()` formatting |
| `pin.test.ts` | 9 | PIN validation rules (length, numeric, sequential) |
| `points.test.ts` | 7 | Points calculation and balance logic |
| `rewards.test.ts` | 8 | Reward eligibility and reservation logic |
| `taskPoints.test.ts` | 8 | Task completion and photo requirement logic |
| `redemptionCode.test.ts` | 7 | Redemption code generation format |

---

## CI/CD Pipeline

Tests run automatically in GitHub Actions on every push to `develop` and `main`:

```
Stage 1: Build    → Checkout, npm ci, TypeScript type check (tsc -b)
Stage 2: Test     → Unit tests (vitest), results shown in GitHub Step Summary
Stage 3: Deploy   → Vercel build + deploy (only if Build and Test pass)
```

If any stage fails, deployment is blocked.

---

## What Must Pass Before a PR Can Be Merged

1. TypeScript type check (`npx tsc -b`)
2. Unit tests (`npm run test:unit`)

If any step fails, the deployment is blocked.

---

## Debugging a Failing Test

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

---

## Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Business logic utilities (`src/lib/`) | 90% | Run `npm run test:coverage` to check |
| React components | 60% | Not yet fully covered |
