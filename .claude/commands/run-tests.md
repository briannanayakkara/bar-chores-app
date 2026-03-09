# /run-tests — Run Full Test Suite

Run the complete test suite for the Bar Chores App in this order:

1. **Unit tests** — `npm run test:unit`
   - Tests pure business logic (points, rewards, PIN, task completion, redemption codes)
   - Tests utility functions (color, date)

2. **Integration tests** — `npm run test:integration`
   - Requires `DEV_SUPABASE_SERVICE_ROLE_KEY` environment variable
   - Tests RLS policies, points ledger triggers, reward reservation flow, staff auth, task completion
   - Runs against the DEV Supabase project

3. **E2E tests** — `npm run test:e2e`
   - Requires the dev server running or Playwright will start one
   - Tests admin login, staff login, task completion, leaderboard, reward request

4. **Coverage report** — `npm run test:coverage`
   - Generates HTML coverage report in `coverage/`

Report any failures and suggest fixes.
