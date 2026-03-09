# src/ — Frontend Code Conventions

## Component Patterns

- Functional components only, function declarations (not arrow exports)
- Props via inline `interface Props { }` at top of file
- Default exports: `export default function ComponentName({ prop }: Props)`
- No prop spreading — always explicit

## File Naming

- Pages: PascalCase matching component name (AdminDashboard.tsx, StaffLogin.tsx)
- Utils: camelCase (supabase.ts, logger.ts, admin-api.ts)
- Contexts: PascalCase with Context suffix (AuthContext.tsx, VenueContext.tsx)
- Types: database.ts — all interfaces centralized in src/types/

## State Management

- AuthContext: session, user, profile, login/logout/refresh methods
- VenueContext: venue data, theme injection via CSS custom properties
- Local state: useState for UI (loading, errors, form values)
- No Redux/Zustand — Context + local state only

## Routing

- Nested routes with layout components (AdminLayout, StaffLayout)
- Route protection: `<RequireAuth allowedRoles={['role']}>`
- All imports at top of App.tsx — no lazy loading
- useNavigate() for programmatic navigation

## Styling

- Tailwind CSS exclusively — no CSS files per component
- Theme colors: primary, accent, background via CSS custom properties
- Color values stored as RGB strings for opacity support
- Touch targets: min-h-[48px] on buttons/interactive elements
- Responsive: md: breakpoint for desktop layouts

## Supabase Usage

- Direct client calls: `supabase.from().select().eq()`
- Edge Functions: `supabase.functions.invoke('name', { body })`
- Promise.all() for parallel queries
- Storage: `supabase.storage.from('bucket').upload()` / `getPublicUrl()`
- Always destructure `{ data, error }` and handle errors

## Import Order

1. React (useState, useEffect, ReactNode)
2. React Router (useNavigate, Link, NavLink)
3. Third-party (@supabase/supabase-js types, bcryptjs)
4. Local contexts (../../context/AuthContext)
5. Local utilities (../../lib/supabase, ../../lib/logger)
6. Types (../../types/database)

## Type Conventions

- `interface` for all data shapes (not `type` keyword)
- Union types for enums: `type UserRole = 'super_admin' | 'venue_admin' | 'staff'`
- All DB types in src/types/database.ts
