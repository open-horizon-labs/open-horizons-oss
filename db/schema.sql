-- Open Horizons OSS Schema
-- Clean Postgres schema (no Supabase, no RLS, no auth)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated_at trigger function (must be defined before tables that use it)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Contexts: workspaces that contain endeavors
CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Context',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Endeavors: nodes in the strategy graph
CREATE TABLE IF NOT EXISTS endeavors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  node_type TEXT NOT NULL DEFAULT 'Aim',
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

-- Node types: configurable strategy hierarchy (managed via Settings > Node Types UI)
CREATE TABLE IF NOT EXISTS node_types (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '📄',
  color TEXT DEFAULT '#6b7280',
  chip_classes TEXT DEFAULT 'bg-gray-100 text-gray-800 border-gray-200',
  valid_children TEXT[] DEFAULT '{}',
  valid_parents TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_endeavors_context_id ON endeavors(context_id);
CREATE INDEX IF NOT EXISTS idx_endeavors_node_type ON endeavors(node_type);
CREATE INDEX IF NOT EXISTS idx_endeavors_status ON endeavors(status);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_endeavor_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_endeavor_id);
CREATE INDEX IF NOT EXISTS idx_edges_relationship ON edges(relationship);

-- Triggers
CREATE OR REPLACE TRIGGER contexts_updated_at
  BEFORE UPDATE ON contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER endeavors_updated_at
  BEFORE UPDATE ON endeavors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER node_types_updated_at
  BEFORE UPDATE ON node_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Metis: patterns, insights, and learnings (human-curated)
CREATE TABLE IF NOT EXISTS metis_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pattern',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guardrails: constraints and rules
CREATE TABLE IF NOT EXISTS guardrails (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates: proposed metis/guardrails from agents, awaiting human review
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'metis',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  promoted_to_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Logs: decision logs, notes, and progress updates tied to endeavors
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL DEFAULT 'endeavor',
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'markdown',
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metis_endeavor ON metis_entries(endeavor_id);
CREATE INDEX IF NOT EXISTS idx_guardrails_endeavor ON guardrails(endeavor_id);
CREATE INDEX IF NOT EXISTS idx_candidates_endeavor ON candidates(endeavor_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(log_date);

CREATE OR REPLACE TRIGGER metis_updated_at BEFORE UPDATE ON metis_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER guardrails_updated_at BEFORE UPDATE ON guardrails FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER logs_updated_at BEFORE UPDATE ON logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
