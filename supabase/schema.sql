-- FieldOps Database Schema
-- Run this in Supabase SQL Editor

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'crew')) DEFAULT 'crew',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Projects (job sites)
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  center_lat DOUBLE PRECISION DEFAULT 32.7767,
  center_lng DOUBLE PRECISION DEFAULT -96.7970,
  zoom INTEGER DEFAULT 17,
  blueprint_url TEXT,
  blueprint_opacity FLOAT DEFAULT 0.5,
  blueprint_bounds JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members (crew assigned to a project)
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)
);

-- Admin-managed type tables
CREATE TABLE IF NOT EXISTS handhole_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedestal_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bore_pipe_sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map items
CREATE TABLE IF NOT EXISTS handholes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type_id UUID REFERENCES handhole_types(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label TEXT,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'needs_attention', 'complete')) DEFAULT 'not_started',
  status_changed_by UUID REFERENCES profiles(id),
  status_changed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedestals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type_id UUID REFERENCES pedestal_types(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label TEXT,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'needs_attention', 'complete')) DEFAULT 'not_started',
  status_changed_by UUID REFERENCES profiles(id),
  status_changed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bore_paths (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  coordinates JSONB NOT NULL,
  pipe_size_id UUID REFERENCES bore_pipe_sizes(id) ON DELETE SET NULL,
  num_pipes INTEGER DEFAULT 1,
  label TEXT,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'needs_attention', 'complete')) DEFAULT 'not_started',
  status_changed_by UUID REFERENCES profiles(id),
  status_changed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist templates (admin-defined per item type)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  item_type TEXT CHECK (item_type IN ('handhole', 'pedestal', 'bore_path')) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist template items (individual checkbox items)
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-item checklist responses (one per map item per template item)
CREATE TABLE IF NOT EXISTS item_checklist_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT CHECK (item_type IN ('handhole', 'pedestal', 'bore_path')) NOT NULL,
  item_id UUID NOT NULL,
  template_item_id UUID REFERENCES checklist_template_items(id) ON DELETE CASCADE,
  checked BOOLEAN DEFAULT FALSE,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMPTZ,
  UNIQUE(item_type, item_id, template_item_id)
);

-- Notes (polymorphic - for any item type)
CREATE TABLE IF NOT EXISTS item_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT CHECK (item_type IN ('handhole', 'pedestal', 'bore_path')) NOT NULL,
  item_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media (optionally attached to a note)
CREATE TABLE IF NOT EXISTS item_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT CHECK (item_type IN ('handhole', 'pedestal', 'bore_path')) NOT NULL,
  item_id UUID NOT NULL,
  note_id UUID REFERENCES item_notes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id),
  url TEXT NOT NULL,
  storage_path TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status change audit log
CREATE TABLE IF NOT EXISTS status_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE handhole_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedestal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE bore_pipe_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE handholes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedestals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bore_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "auth_read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "auth_insert_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Projects
CREATE POLICY "auth_read_projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_projects" ON projects FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_update_projects" ON projects FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_delete_projects" ON projects FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Project members
CREATE POLICY "auth_read_project_members" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_project_members" ON project_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Type tables (read all, write admin)
CREATE POLICY "auth_read_handhole_types" ON handhole_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_handhole_types" ON handhole_types FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_read_pedestal_types" ON pedestal_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_pedestal_types" ON pedestal_types FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_read_pipe_sizes" ON bore_pipe_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_pipe_sizes" ON bore_pipe_sizes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Map items
CREATE POLICY "auth_read_handholes" ON handholes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_handholes" ON handholes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "auth_update_handholes" ON handholes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_pedestals" ON pedestals FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_pedestals" ON pedestals FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_read_bore_paths" ON bore_paths FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_bore_paths" ON bore_paths FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Checklists
CREATE POLICY "auth_read_cl_templates" ON checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_cl_templates" ON checklist_templates FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_read_cl_items" ON checklist_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_cl_items" ON checklist_template_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_manage_cl_responses" ON item_checklist_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notes & media
CREATE POLICY "auth_manage_notes" ON item_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_media" ON item_media FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Status logs
CREATE POLICY "auth_read_status_logs" ON status_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_status_logs" ON status_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- SEED DATA (optional default types - uncomment to use)
-- ============================================================
-- INSERT INTO handhole_types (name, description) VALUES
--   ('6x6 Standard', '6x6 inch standard handhole'),
--   ('12x24 Large', '12x24 inch large handhole'),
--   ('17x30 XL', '17x30 inch extra large handhole');
-- 
-- INSERT INTO pedestal_types (name, description) VALUES
--   ('Mini Pedestal', 'Small fiber pedestal'),
--   ('Standard Pedestal', 'Standard size pedestal'),
--   ('Large Pedestal', 'Large capacity pedestal');
-- 
-- INSERT INTO bore_pipe_sizes (name, description) VALUES
--   ('1 inch', '1" conduit'),
--   ('1.25 inch', '1.25" conduit'),
--   ('2 inch', '2" conduit'),
--   ('4 inch', '4" conduit');
