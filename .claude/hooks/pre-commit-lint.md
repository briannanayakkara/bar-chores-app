# Pre-Commit Lint Hook

Run before creating git commits to catch issues early.

## Checks

1. `npm run lint` — ESLint flat config v9
2. `npx tsc -b` — TypeScript type checking

## Behavior

- If either check fails, block the commit
- Show the specific errors so they can be fixed
- Do not auto-fix — show the issues and let the developer decide

## When to Skip

Only skip if the user explicitly requests `--no-verify` (e.g., WIP commits).
