-- Open Horizons OSS Schema
-- Clean Postgres schema (no Supabase, no RLS, no auth)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Contexts: workspaces that contain endeavors
CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Context',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Endeavors: nodes in the hierarchy (Mission > Aim > Initiative > Task)
CREATE TABLE IF NOT EXISTS endeavors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  node_type TEXT NOT NULL DEFAULT 'Task' CHECK (node_type IN ('Mission', 'Aim', 'Initiative', 'Task')),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edges: relationships between endeavors (parent-child via 'contains', or custom)
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  from_endeavor_id TEXT NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,
  to_endeavor_id TEXT NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'contains',
  weight REAL DEFAULT 1.0,
  context TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT edges_no_self_loop CHECK (from_endeavor_id != to_endeavor_id),
  CONSTRAINT edges_unique_relationship UNIQUE (from_endeavor_id, to_endeavor_id, relationship)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_endeavors_context_id ON endeavors(context_id);
CREATE INDEX IF NOT EXISTS idx_endeavors_node_type ON endeavors(node_type);
CREATE INDEX IF NOT EXISTS idx_endeavors_status ON endeavors(status);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_endeavor_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_endeavor_id);
CREATE INDEX IF NOT EXISTS idx_edges_relationship ON edges(relationship);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER endeavors_updated_at
  BEFORE UPDATE ON endeavors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER contexts_updated_at
  BEFORE UPDATE ON contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
