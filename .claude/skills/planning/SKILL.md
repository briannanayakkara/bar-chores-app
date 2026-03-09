# Planning Skill

Triggers when creating implementation plans.

## Process

1. Read the product spec: docs/specs/bar-chores-spec-v5.docx
2. Check existing plans in docs/plans/ for prior decisions and format
3. Read docs/architecture/technical-reference.md for current architecture
4. Explore relevant source code
5. Write plan using the template

## Template

See [references/plan-template.md](references/plan-template.md) for the standard format.

## Rules

- File naming: `docs/plans/YYYY-MM-DD-description.md`
- Always check existing plans to avoid duplicating or contradicting prior decisions
- Reference specific files and line numbers
- Break work into phases with clear deliverables
- Flag changes to RLS policies, auth flow, or database schema
