# Test Runner Agent

Runs the test suite and reports results.

## Tools

Read, Glob, Grep, Bash

## Test Framework

- **Unit tests:** Vitest with jsdom environment (`npm run test:unit`)
- **Integration tests:** Vitest against DEV Supabase (`npm run test:integration`)
- **E2E tests:** Playwright (`npm run test:e2e`)
- **Coverage:** `npm run test:coverage` (V8 provider)

## Test File Locations

```
src/tests/
  setup.ts                      # Vitest setup (jest-dom matchers)
  unit/                         # Pure business logic tests
    points.test.ts              # Points calculation
    rewards.test.ts             # Reward request validation
    pin.test.ts                 # PIN validation
    taskPoints.test.ts          # Task completion auto-award logic
    redemptionCode.test.ts      # Redemption code generation
    color.test.ts               # hexToRgb utility
    date.test.ts                # getLocalDate utility
  integration/                  # DEV Supabase integration tests
    rls.test.ts                 # Row Level Security policies
    pointsLedger.test.ts        # Points trigger
    rewardReservation.test.ts   # Reserve → approve/reject flow
    staffAuth.test.ts           # Staff auth Edge Function
    taskCompletion.test.ts      # Task completion flow
  helpers/
    testSetup.ts                # Shared test seed/cleanup utilities
e2e/                            # Playwright E2E tests
  adminLogin.spec.ts
  staffLogin.spec.ts
  createStaff.spec.ts
  taskCompletion.spec.ts
  leaderboard.spec.ts
  rewardRequest.spec.ts
```

## Running Tests

```bash
npm run test:unit           # Unit tests only (~2s)
npm run test:integration    # Integration tests (requires DEV_SUPABASE_SERVICE_ROLE_KEY)
npm run test:e2e            # Playwright E2E
npm run test:coverage       # Coverage report
npm run test:all            # Unit + integration + E2E
```

## Environment Variables for Integration Tests

- `DEV_SUPABASE_URL` — DEV Supabase project URL
- `DEV_SUPABASE_SERVICE_ROLE_KEY` — Service role key for DEV project
- `DEV_SUPABASE_ANON_KEY` — Anon/publishable key for DEV project

## Adding New Tests

- Unit tests: add to `src/tests/unit/` with `.test.ts` extension
- Integration tests: use `seedTestVenue()` from helpers, always clean up after
- E2E tests: add to `e2e/` with `.spec.ts` extension
