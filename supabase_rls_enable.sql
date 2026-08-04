-- ==============================================================================
-- INSIGHTAI SUPABASE SECURITY & ROW-LEVEL SECURITY (RLS) ENFORCEMENT SCRIPT
-- Resolves Supabase Security Warning: "rls_disabled_in_public"
-- ==============================================================================

-- 1. Enable Row-Level Security (RLS) on all InsightAI public tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.imported_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Revoke default public/anon permissions on sensitive tables
-- Direct anonymous access via Supabase REST API is denied for data security.
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.projects FROM anon;
REVOKE ALL ON TABLE public.data_sources FROM anon;
REVOKE ALL ON TABLE public.imported_datasets FROM anon;
REVOKE ALL ON TABLE public.query_history FROM anon;
REVOKE ALL ON TABLE public.saved_dashboards FROM anon;
REVOKE ALL ON TABLE public.user_preferences FROM anon;

-- 3. Grant access privileges to authenticated users and service_role (backend API execution)
GRANT ALL ON TABLE public.users TO authenticated, service_role;
GRANT ALL ON TABLE public.projects TO authenticated, service_role;
GRANT ALL ON TABLE public.data_sources TO authenticated, service_role;
GRANT ALL ON TABLE public.imported_datasets TO authenticated, service_role;
GRANT ALL ON TABLE public.query_history TO authenticated, service_role;
GRANT ALL ON TABLE public.saved_dashboards TO authenticated, service_role;
GRANT ALL ON TABLE public.user_preferences TO authenticated, service_role;

-- 4. Create RLS Policies for Anonymous Role (Explicit Deny)
DROP POLICY IF EXISTS "Deny anonymous access on users" ON public.users;
CREATE POLICY "Deny anonymous access on users" ON public.users FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on projects" ON public.projects;
CREATE POLICY "Deny anonymous access on projects" ON public.projects FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on data_sources" ON public.data_sources;
CREATE POLICY "Deny anonymous access on data_sources" ON public.data_sources FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on imported_datasets" ON public.imported_datasets;
CREATE POLICY "Deny anonymous access on imported_datasets" ON public.imported_datasets FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on query_history" ON public.query_history;
CREATE POLICY "Deny anonymous access on query_history" ON public.query_history FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on saved_dashboards" ON public.saved_dashboards;
CREATE POLICY "Deny anonymous access on saved_dashboards" ON public.saved_dashboards FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anonymous access on user_preferences" ON public.user_preferences;
CREATE POLICY "Deny anonymous access on user_preferences" ON public.user_preferences FOR ALL TO anon USING (false);

-- 5. Create RLS Policies for Authenticated & Service Role Access
-- Table: users
DROP POLICY IF EXISTS "Service role full access on users" ON public.users;
CREATE POLICY "Service role full access on users" ON public.users FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT TO authenticated USING (auth.uid()::text = firebase_uid OR id = auth.uid()::text);

-- Table: projects
DROP POLICY IF EXISTS "Service role full access on projects" ON public.projects;
CREATE POLICY "Service role full access on projects" ON public.projects FOR ALL TO service_role USING (true);

-- Table: data_sources
DROP POLICY IF EXISTS "Service role full access on data_sources" ON public.data_sources;
CREATE POLICY "Service role full access on data_sources" ON public.data_sources FOR ALL TO service_role USING (true);

-- Table: imported_datasets
DROP POLICY IF EXISTS "Service role full access on imported_datasets" ON public.imported_datasets;
CREATE POLICY "Service role full access on imported_datasets" ON public.imported_datasets FOR ALL TO service_role USING (true);

-- Table: query_history
DROP POLICY IF EXISTS "Service role full access on query_history" ON public.query_history;
CREATE POLICY "Service role full access on query_history" ON public.query_history FOR ALL TO service_role USING (true);

-- Table: saved_dashboards
DROP POLICY IF EXISTS "Service role full access on saved_dashboards" ON public.saved_dashboards;
CREATE POLICY "Service role full access on saved_dashboards" ON public.saved_dashboards FOR ALL TO service_role USING (true);

-- Table: user_preferences
DROP POLICY IF EXISTS "Service role full access on user_preferences" ON public.user_preferences;
CREATE POLICY "Service role full access on user_preferences" ON public.user_preferences FOR ALL TO service_role USING (true);

-- 6. Enforce default privileges for future table creations in schema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
