# Post-Write Format Hook

After writing to .ts/.tsx/.js/.jsx files, run ESLint auto-fix.

## Command

```bash
npx eslint --fix <file>
```

## Notes

- No Prettier is configured — ESLint is the only formatter
- Only runs on TypeScript/JavaScript files
- Silently succeeds if no fixable issues found
- Reports unfixable issues for manual attention
