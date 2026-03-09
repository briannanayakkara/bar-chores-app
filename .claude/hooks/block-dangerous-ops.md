# Block Dangerous Operations Hook

Block commands that could cause irreversible damage.

## Blocked Patterns

### File System
- `rm -rf` (any path)
- `rm *` or `rm -r *`

### Database
- `DROP TABLE` (case-insensitive)
- `DROP DATABASE` (case-insensitive)
- `TRUNCATE` (case-insensitive, outside of seed scripts)
- `DELETE FROM` without a WHERE clause

### Git
- `git push --force` to main or develop
- `git reset --hard` on main or develop

## Behavior

- Exit code 2 (block execution)
- Display clear warning explaining why the command was blocked
- Suggest safe alternative if available

## Exceptions

- Seed script (`scripts/seed-reset.mjs`) is allowed to TRUNCATE — it's designed for that
- User can explicitly override with confirmation
