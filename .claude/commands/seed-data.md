# /seed-data — Reset and Seed Database

Reset and seed the Supabase database with test data.

## Reference

See docs/api/seed-data.md for expected data definitions.

## Steps

1. Confirm target environment (dev or prod) — default to dev, warn if prod
2. Run: `node scripts/seed-reset.mjs [dev|prod]`
3. Verify expected row counts:
   - 2 venues (Little Green Door, KOKO)
   - 13 profiles (1 super admin + 2 venue admins + 10 staff)
   - 40 tasks (20 per venue)
   - 10 task assignments (initial)
4. Report results

## Safety

- Always confirm before running against prod
- Script handles: truncate all tables, re-seed in correct FK order
- Super admin account is preserved (not deleted during reset)
