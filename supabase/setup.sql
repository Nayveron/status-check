-- ================================================================
-- Status Check — FULL SETUP (idempotent)
-- Run once in Supabase SQL Editor on a fresh project.
-- Consolidates the former schema + migrations v2–v8.
-- Then run supabase-seed.sql for demo data (optional).
-- ================================================================

-- ── Tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name       TEXT NOT NULL,
  initials   TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_super   BOOLEAN NOT NULL DEFAULT false,   -- owner: only a super manages roles
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  deadline    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commitments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'assigned',
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  author_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  executor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  checker_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deadline       DATE NOT NULL,
  deadline_time  TIME,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE commitments DROP CONSTRAINT IF EXISTS commitments_status_check;
ALTER TABLE commitments ADD CONSTRAINT commitments_status_check
  CHECK (status IN ('assigned','in_progress','to_check','expired','done','not_actual','ideas_backlog'));

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, profile_id)
);

CREATE TABLE IF NOT EXISTS commitment_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commitment_id UUID REFERENCES commitments(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,            -- 'created' | 'status'
  from_status   TEXT,
  to_status     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS commitment_events_commitment_idx ON commitment_events(commitment_id);

-- ── Functions & triggers ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER commitments_updated_at
  BEFORE UPDATE ON commitments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- New users are always created as 'user' (never trust client-supplied role).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, initials, color, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 2)),
    COALESCE(NEW.raw_user_meta_data->>'color', '#6366f1'),
    'user'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role check helper (SECURITY DEFINER → no RLS recursion).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- only a super-checker (owner) manages roles
CREATE OR REPLACE FUNCTION public.is_super()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super = true)
$$;

-- Auto-expire: to_check past its deadline → expired.
CREATE OR REPLACE FUNCTION public.expire_overdue_commitments()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE commitments SET status = 'expired'
  WHERE status = 'to_check' AND deadline < CURRENT_DATE;
$$;
GRANT EXECUTE ON FUNCTION public.expire_overdue_commitments() TO authenticated;

-- Activity log: record creation + every status change (actor NULL = system/cron).
CREATE OR REPLACE FUNCTION public.log_commitment_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO commitment_events (commitment_id, actor_id, type, to_status)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.author_id), 'created', NEW.status);
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO commitment_events (commitment_id, actor_id, type, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS commitments_event_log ON commitments;
CREATE TRIGGER commitments_event_log
  AFTER INSERT OR UPDATE ON commitments
  FOR EACH ROW EXECUTE FUNCTION public.log_commitment_event();

-- ── Row Level Security ───────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ce_select" ON commitment_events;
CREATE POLICY "ce_select" ON commitment_events FOR SELECT TO authenticated USING (true);

-- profiles
DROP POLICY IF EXISTS "profiles_select"       ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_select"     ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
-- users may edit their own profile but NOT change their own role or super flag (anti-escalation)
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role     = (SELECT role     FROM profiles WHERE id = auth.uid())
    AND is_super = (SELECT is_super FROM profiles WHERE id = auth.uid())
  );
-- role management: super changes anyone; admin changes only executors (not checkers/super)
DROP POLICY IF EXISTS "profiles_super_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update_executors" ON profiles;
CREATE POLICY "profiles_super_update" ON profiles FOR UPDATE TO authenticated
  USING (public.is_super()) WITH CHECK (public.is_super());
CREATE POLICY "profiles_admin_update_executors" ON profiles FOR UPDATE TO authenticated
  USING (public.is_admin() AND role = 'user' AND is_super = false)
  WITH CHECK (public.is_admin() AND is_super = false);

-- projects
DROP POLICY IF EXISTS "projects_select"    ON projects;
DROP POLICY IF EXISTS "projects_all_admin" ON projects;
CREATE POLICY "projects_select"    ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_all_admin" ON projects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- commitments
DROP POLICY IF EXISTS "commitments_select"           ON commitments;
DROP POLICY IF EXISTS "commitments_admin_all"        ON commitments;
DROP POLICY IF EXISTS "commitments_executor_insert"  ON commitments;
DROP POLICY IF EXISTS "commitments_executor_update"  ON commitments;
CREATE POLICY "commitments_select" ON commitments FOR SELECT TO authenticated USING (true);
CREATE POLICY "commitments_admin_all" ON commitments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- executors create tasks for themselves OR into the shared pool (executor_id NULL)
CREATE POLICY "commitments_executor_insert" ON commitments FOR INSERT TO authenticated
  WITH CHECK (executor_id = auth.uid() OR executor_id IS NULL);
-- executors update their own tasks OR claim an unowned pool task
CREATE POLICY "commitments_executor_update" ON commitments FOR UPDATE TO authenticated
  USING (executor_id = auth.uid() OR executor_id IS NULL)
  WITH CHECK (executor_id = auth.uid());

-- project_members
DROP POLICY IF EXISTS "pm_select"    ON project_members;
DROP POLICY IF EXISTS "pm_admin_all" ON project_members;
CREATE POLICY "pm_select" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_admin_all" ON project_members FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Realtime ─────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE commitments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed base projects ───────────────────────────────────────────
INSERT INTO projects (name) VALUES
  ('Platform'), ('Mobile App'), ('Marketing'), ('Infrastructure')
ON CONFLICT (name) DO NOTHING;

-- ── Promote a checker (run manually) ─────────────────────────────
-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'checker@company.com');
--
-- Optional (production) auto-expire even when nobody is online — needs pg_cron:
--   SELECT cron.schedule('expire-commitments', '*/15 * * * *',
--     $$ SELECT public.expire_overdue_commitments(); $$);
