# /plan — Create Implementation Plan

Create an implementation plan for: $ARGUMENTS

## Steps

1. Read the product spec: docs/specs/bar-chores-spec-v5.docx
2. Read existing plans in docs/plans/ to understand format and avoid conflicts
3. Read docs/architecture/technical-reference.md for current architecture
4. Explore relevant source code to understand current state
5. Create plan file: `docs/plans/YYYY-MM-DD-{topic}.md`

## Plan Template

```markdown
# {Title}

## Context
Why this work is needed.

## Scope
What's included and what's explicitly excluded.

## Current State
Relevant existing code, schema, and config with file references.

## Tasks

### Phase 1: {name}
- [ ] Task description (file reference)
- [ ] Task description

### Phase 2: {name}
- [ ] Task description

## Verification
How to confirm the work is complete.

## Notes
Edge cases, open questions, dependencies.
```
