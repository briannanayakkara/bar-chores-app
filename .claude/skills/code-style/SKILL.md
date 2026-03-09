# Code Style Skill

Triggers when writing or editing .ts/.tsx/.js/.jsx files.

## Quick Reference

See [references/style-guide.md](references/style-guide.md) for detailed conventions with examples.

Also consult:
- Root CLAUDE.md for project-wide conventions
- src/CLAUDE.md for frontend-specific patterns

## Key Rules

1. **Components** — function declarations, Props interface, default export
2. **Naming** — PascalCase files for components/contexts, camelCase for utils
3. **Imports** — strict ordering: react > router > third-party > contexts > libs > types
4. **Types** — interfaces over type aliases, all DB types centralized
5. **Styling** — Tailwind only, no CSS modules, use theme CSS variables
6. **Errors** — always handle `{ data, error }` from Supabase
7. **Touch targets** — min-h-[48px] on interactive elements
