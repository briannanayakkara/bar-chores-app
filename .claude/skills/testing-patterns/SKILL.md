# Testing Patterns Skill

Triggers when writing or running tests.

## Current State

Vitest is NOT yet configured in this project. If tests are needed:

1. Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
2. Add to vite.config.ts:
   ```ts
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: './src/test/setup.ts'
   }
   ```
3. Add to package.json: `"test": "vitest"`
4. Create `src/test/setup.ts` with `import '@testing-library/jest-dom'`

## Test File Conventions

- Co-located: `ComponentName.test.tsx` next to `ComponentName.tsx`
- Utility tests: `utils.test.ts` next to `utils.ts`
- Use describe/it/expect from vitest

## Patterns

### Component Test
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TaskCard from './TaskCard'

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard title="Clean Fridges" points={150} />)
    expect(screen.getByText('Clean Fridges')).toBeInTheDocument()
  })
})
```

### Mocking Supabase
```tsx
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}))
```

## Scripts

See [scripts/gen-test.py](scripts/gen-test.py) for test boilerplate generation.
