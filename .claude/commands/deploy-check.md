# /deploy-check — Pre-Deploy Checklist

Run all pre-deployment checks and report pass/fail for each.

## Checks

1. **Build** — `npm run build` (includes tsc -b type checking)
2. **Lint** — `npm run lint`
3. **Environment** — verify .env file exists with required variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
4. **Version** — check package.json version was bumped since last deploy
5. **Migrations** — check if any new SQL files in supabase/migrations/ need to be applied
6. **Edge Functions** — check if supabase/functions/ has changes that need deploying
7. **Git status** — no uncommitted changes, on correct branch

## Output

```
Pre-Deploy Checklist
--------------------
[PASS] Build compiles without errors
[PASS] Lint passes
[PASS] Environment variables present
[FAIL] Version not bumped (current: X.X.X, last deployed: X.X.X)
[WARN] New migration 006_xxx.sql — apply before deploying
[PASS] Edge Functions unchanged
[PASS] Git clean, on feature/xxx branch
```

Block deploy recommendation if any check fails.
