# /fix-issue — Diagnose and Fix an Issue

Diagnose and fix: $ARGUMENTS

## Steps

1. **Understand** — parse the issue description, identify expected vs actual behavior
2. **Locate** — find related files using Grep/Glob, read relevant code
3. **Diagnose** — trace the data/control flow, check:
   - Supabase queries and RLS policies
   - Auth state and session handling
   - Edge Function request/response
   - Component state and re-renders
   - Type mismatches
4. **Fix** — implement the minimum change needed
5. **Verify** — run `npm run build` and `npm run lint` to confirm no regressions
6. **Explain** — describe root cause and what was changed
