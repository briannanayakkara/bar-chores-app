# Code Style Guide — Quick Lookup

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Page component | PascalCase.tsx | `AdminDashboard.tsx` |
| UI component | PascalCase.tsx | `TaskCard.tsx` |
| Layout | PascalCase.tsx | `AdminLayout.tsx` |
| Context | PascalCaseContext.tsx | `AuthContext.tsx` |
| Utility | camelCase.ts | `supabase.ts`, `logger.ts` |
| API helper | kebab-case.ts | `admin-api.ts` |
| Types | camelCase.ts | `database.ts` |

## Component Pattern

```tsx
// DO
interface Props {
  title: string
  onClose: () => void
}

export default function TaskCard({ title, onClose }: Props) {
  return <div>...</div>
}

// DON'T
export const TaskCard = ({ title, ...rest }: any) => <div {...rest} />
```

## Import Order

```tsx
// 1. React
import { useState, useEffect } from 'react'

// 2. React Router
import { useNavigate, Link } from 'react-router-dom'

// 3. Third-party
import type { User } from '@supabase/supabase-js'

// 4. Local contexts
import { useAuth } from '../../context/AuthContext'

// 5. Local utilities
import { supabase } from '../../lib/supabase'
import { logger } from '../../lib/logger'

// 6. Types
import type { Task, Profile } from '../../types/database'
```

## Supabase Query Pattern

```tsx
// DO — always destructure and handle errors
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('venue_id', venueId)

if (error) {
  logger.error('Failed to fetch tasks', error.message)
  return
}

// DON'T — ignoring errors
const { data } = await supabase.from('tasks').select('*')
```

## Tailwind Patterns

```tsx
// DO — responsive, accessible
<button className="min-h-[48px] px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 md:px-6">

// DON'T — inline styles, small targets
<button style={{ padding: '4px' }}>
```

## Common Anti-Patterns

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| `export const Component = () =>` | `export default function Component()` |
| `type Props = { }` | `interface Props { }` |
| `<div {...props}>` | Explicit prop passing |
| `useState<any>()` | `useState<SpecificType>()` |
| `import styles from './x.css'` | Tailwind classes inline |
| Nested ternaries in JSX | Extract to variables or early returns |
