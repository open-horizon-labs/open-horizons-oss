-- Seed data: default node types and an empty context

-- Default node types (Open Horizons hierarchy)
-- Users can change these via Settings > Node Types or the /api/node-types API
INSERT INTO node_types (slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order) VALUES
  ('mission',    'Mission',    'High-level purpose and direction',            '🎯', '#7c3aed', 'bg-purple-100 text-purple-800 border-purple-200', '{aim}',        '{}',           0),
  ('aim',        'Aim',        'Strategic objectives and measurable outcomes', '🏹', '#2563eb', 'bg-blue-100 text-blue-800 border-blue-200',     '{initiative}', '{mission}',    1),
  ('initiative', 'Initiative', 'Active projects and work streams',            '🚀', '#16a34a', 'bg-green-100 text-green-800 border-green-200',   '{task}',       '{aim}',        2),
  ('task',       'Task',       'Specific actionable items',                   '✓',  '#6b7280', 'bg-gray-100 text-gray-800 border-gray-200',      '{}',           '{initiative}', 3)
ON CONFLICT (slug) DO NOTHING;

-- Default context (empty — user creates their own graph)
INSERT INTO contexts (id, title, description) VALUES
  ('default', 'Default Context', 'Your strategy graph')
ON CONFLICT (id) DO NOTHING;
