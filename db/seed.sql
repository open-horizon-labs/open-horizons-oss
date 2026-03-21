-- Seed data: a default context with example Mission > Aim > Initiative hierarchy

-- Default context
INSERT INTO contexts (id, title, description) VALUES
  ('default', 'Default Context', 'Your personal workspace for organizing endeavors')
ON CONFLICT (id) DO NOTHING;

-- Example Mission
INSERT INTO endeavors (id, context_id, title, description, node_type, status) VALUES
  ('seed-mission-1', 'default', 'Build a Sustainable Business', 'Create a profitable and impactful company that solves real problems', 'Mission', 'active')
ON CONFLICT (id) DO NOTHING;

-- Example Aims under the Mission
INSERT INTO endeavors (id, context_id, title, description, node_type, status) VALUES
  ('seed-aim-1', 'default', 'Achieve Product-Market Fit', 'Validate that our product solves a real problem people will pay for', 'Aim', 'active'),
  ('seed-aim-2', 'default', 'Build a Strong Team', 'Attract and retain talented people who share our vision', 'Aim', 'active')
ON CONFLICT (id) DO NOTHING;

-- Example Initiatives under Aim 1
INSERT INTO endeavors (id, context_id, title, description, node_type, status) VALUES
  ('seed-init-1', 'default', 'Customer Discovery Interviews', 'Talk to 50 potential customers to understand their pain points', 'Initiative', 'active'),
  ('seed-init-2', 'default', 'MVP Launch', 'Ship a minimum viable product to early adopters', 'Initiative', 'active')
ON CONFLICT (id) DO NOTHING;

-- Example Tasks under Initiative 1
INSERT INTO endeavors (id, context_id, title, description, node_type, status) VALUES
  ('seed-task-1', 'default', 'Draft interview script', 'Create a structured interview guide for customer conversations', 'Task', 'active'),
  ('seed-task-2', 'default', 'Schedule first 10 interviews', 'Reach out to contacts and book customer discovery sessions', 'Task', 'active')
ON CONFLICT (id) DO NOTHING;

-- Edges: Mission > Aim > Initiative > Task hierarchy
INSERT INTO edges (id, from_endeavor_id, to_endeavor_id, relationship) VALUES
  ('seed-edge-1', 'seed-mission-1', 'seed-aim-1', 'contains'),
  ('seed-edge-2', 'seed-mission-1', 'seed-aim-2', 'contains'),
  ('seed-edge-3', 'seed-aim-1', 'seed-init-1', 'contains'),
  ('seed-edge-4', 'seed-aim-1', 'seed-init-2', 'contains'),
  ('seed-edge-5', 'seed-init-1', 'seed-task-1', 'contains'),
  ('seed-edge-6', 'seed-init-1', 'seed-task-2', 'contains')
ON CONFLICT (from_endeavor_id, to_endeavor_id, relationship) DO NOTHING;
