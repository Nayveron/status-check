# Supabase setup

Two files, run in order in the **Supabase SQL Editor**:

1. **`setup.sql`** — complete, idempotent schema: tables, triggers, RLS policies,
   `is_admin()` / `is_super()` helpers, auto-expire + activity-log functions, Realtime.
   Safe to re-run.
2. **`seed.sql`** *(optional)* — demo data: 4 projects with members + a pool of tasks.

Then:

3. **Make yourself the super-checker** (owner — only a super manages roles):
   ```sql
   UPDATE profiles SET role = 'admin', is_super = true
   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
   ```

4. **App env** — copy `.env.local.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # publishable key
   ```

5. **Auth (dashboard)** — Authentication → Providers → Email → enable **Confirm email**;
   Authentication → URL Configuration → set **Site URL** and add **Redirect URLs**
   (`https://your-app/**`, `http://localhost:3000/**`).

## Roles model
- **executor (`user`)** — picks tasks from the shared pool, executes, submits for review.
- **checker (`admin`)** — verifies commitments; can manage **executors'** roles.
- **super-checker (`is_super`)** — the owner; the only one who can manage **checkers'** roles.
  Set via the SQL above (not exposed in the UI).
