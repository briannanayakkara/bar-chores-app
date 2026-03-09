# RLS Policy Reference

## Helper Functions

Both defined in `public` schema (NOT auth schema — Supabase blocks writes to auth):

```sql
-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the venue_id of the currently authenticated user
CREATE OR REPLACE FUNCTION public.user_venue_id()
RETURNS uuid AS $$
  SELECT venue_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

## Policy Tiers

### Tier 1 — Super Admin Bypass
Full access to everything. Applied on every table.
```sql
CREATE POLICY super_admin_full_access ON {table}
  FOR ALL USING (public.user_role() = 'super_admin');
```

### Tier 2 — Admin Venue Scoping
Admin can manage data within their own venue only.
```sql
CREATE POLICY admin_manage_{table} ON {table}
  FOR ALL USING (
    public.user_role() = 'venue_admin'
    AND venue_id = public.user_venue_id()
  );
```

### Tier 3 — Staff Read Own Venue
Staff can read data from their venue.
```sql
CREATE POLICY staff_read_{table} ON {table}
  FOR SELECT USING (
    public.user_role() = 'staff'
    AND venue_id = public.user_venue_id()
  );
```

### Tier 4 — Staff Own Data
Staff can modify only their own records.
```sql
CREATE POLICY staff_own_{table} ON {table}
  FOR UPDATE USING (
    assigned_to = auth.uid()  -- or profile_id = auth.uid()
  );
```

### Tier 5 — Anonymous/Public Access
Unauthenticated read access for login pages.
```sql
CREATE POLICY anon_read_{table} ON {table}
  FOR SELECT USING (true);
```
Applied to: venues, venue_settings, staff profiles (for login card display).

## Adding a New Policy

1. Determine which tier applies
2. Follow naming convention: `{role}_{action}_{table}`
3. Add to a new migration file (next number: 006)
4. Test by querying as each role to verify access
5. Check that venue isolation is maintained (data doesn't leak between venues)

## Common Pitfalls

- Forgetting to add super_admin bypass on new tables
- Missing venue_id scoping on admin policies (data leaks between venues)
- Not adding anon policies for data needed on login pages
- Using `auth.uid()` directly when you need `public.user_venue_id()`
