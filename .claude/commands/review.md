# /review — Review Uncommitted Changes

Review all uncommitted changes against project conventions.

## Steps

1. Run `git diff` and `git diff --cached` to see all staged and unstaged changes
2. Run `git status` to see new/deleted files
3. For each changed file, check against CLAUDE.md conventions:
   - Naming: PascalCase components, camelCase utils
   - Import ordering: react > react-router > third-party > contexts > libs > types
   - Component pattern: function declaration, Props interface, default export
   - Types: interface over type, no `any`, DB types from src/types/database.ts
   - Supabase: `{ data, error }` destructuring, error handling
   - Tailwind: no inline styles, min-h-[48px] touch targets
   - Security: no hardcoded credentials, no secrets in code
4. Report issues grouped by severity (error / warning / suggestion)
5. Summarize: X files changed, Y issues found
