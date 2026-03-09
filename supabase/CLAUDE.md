# supabase/ — Database & Edge Function Conventions

## Migration Conventions

- File naming: NNN_descriptive_name.sql (zero-padded 3-digit prefix)
- One logical concern per file (schema, RLS, triggers, cron)
- Section dividers: `-- ============` with descriptive comments
- Next migration number: 011

## RLS Patterns

Helper functions in `public` schema (NOT auth schema):
- `public.user_role()` -> text (from profiles via auth.uid())
- `public.user_venue_id()` -> uuid (from profiles via auth.uid())
- All functions: SECURITY DEFINER STABLE

Policy naming: snake_case `{role}_{action}_{table}` (e.g. admin_manage_venue_tasks)

Tier system:
1. **Super admin bypass:** `FOR ALL USING (public.user_role() = 'super_admin')`
2. **Admin venue scoping:** `venue_id = public.user_venue_id() AND role = 'venue_admin'`
3. **Staff read own venue:** `FOR SELECT USING (venue_id = public.user_venue_id())`
4. **Staff own data:** `assigned_to = auth.uid()` or `profile_id = auth.uid()`
5. **Anon/public:** `FOR SELECT USING (true)` on venues, venue_settings, staff profiles

## Edge Functions

- Directory naming: kebab-case (staff-auth, admin-actions)
- Runtime: Deno (`serve()` from std@0.177.0)
- Always return JSON via helper function
- CORS headers on all responses
- Error responses: HTTP 200 with `{ error: "..." }` in body (supabase.functions.invoke limitation)
- Auth: validate Authorization header, look up caller profile for role check
- Service role key: `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- bcrypt: `await bcrypt.hash(String(pin), await bcrypt.genSalt(10))` for creation, `await bcrypt.compare(String(pin), hash)` for verification (async only — hashSync crashes on Deno Deploy)

## Auth Handling

- Admin auth: standard Supabase email/password
- Staff auth: PIN -> staff-auth function -> bcrypt verify -> magic link token -> verifyOtp
- Staff emails: synthetic (`staff_username@{venueId}.internal`)
- JWT claims: sub=profile.id, role=authenticated, custom: venue_id, user_role
- Session: onAuthStateChange listener for auto-restore

## Database Conventions

- Table naming: snake_case plural (venues, profiles, tasks)
- Column naming: snake_case (venue_id, points_total, frequency)
- Index naming: idx_{table}_{field(s)}
- Trigger naming: trg_{table}_{action}
- CHECK constraints for enum-like values
- FK with CASCADE DELETE where appropriate
- UUID primary keys (gen_random_uuid())
