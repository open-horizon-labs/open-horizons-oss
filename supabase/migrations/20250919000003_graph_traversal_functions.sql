-- Phase 1c: Graph Traversal Functions
-- Core functions for traversing the endeavor graph within access bounds

-- 1. Get accessible subgraph starting from specific roots
CREATE OR REPLACE FUNCTION get_accessible_subgraph(
  p_user_id uuid,
  p_root_ids text[] DEFAULT NULL,
  p_max_depth int DEFAULT 10,
  p_relationships text[] DEFAULT ARRAY['supports', 'refines']
)
RETURNS TABLE(
  endeavor_id text,
  depth int,
  path text[],
  access_type text,
  relationship text,
  parent_id text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no root IDs specified, use all accessible endeavors
  IF p_root_ids IS NULL THEN
    p_root_ids := ARRAY(
      SELECT ae.endeavor_id
      FROM get_accessible_endeavors(p_user_id) ae
    );
  END IF;

  RETURN QUERY
  WITH RECURSIVE endeavor_tree AS (
    -- Base case: root endeavors
    SELECT
      e.id as endeavor_id,
      0 as depth,
      ARRAY[e.id] as path,
      ae.access_type,
      ''::text as relationship,
      ''::text as parent_id
    FROM endeavors e
    JOIN get_accessible_endeavors(p_user_id) ae ON ae.endeavor_id = e.id
    WHERE e.id = ANY(p_root_ids)
      AND e.archived_at IS NULL

    UNION ALL

    -- Recursive case: follow edges within access bounds
    SELECT
      target_e.id as endeavor_id,
      et.depth + 1,
      et.path || target_e.id,
      ae.access_type,
      edge.relationship,
      et.endeavor_id as parent_id
    FROM endeavor_tree et
    JOIN edges edge ON edge.from_endeavor_id = et.endeavor_id
    JOIN endeavors target_e ON target_e.id = edge.to_endeavor_id
    JOIN get_accessible_endeavors(p_user_id) ae ON ae.endeavor_id = target_e.id
    WHERE et.depth < p_max_depth
      AND edge.relationship = ANY(p_relationships)
      AND target_e.id != ALL(et.path) -- Prevent cycles
      AND target_e.archived_at IS NULL
      AND (edge.expires_at IS NULL OR edge.expires_at > now())
  )
  SELECT
    et.endeavor_id,
    et.depth,
    et.path,
    et.access_type,
    et.relationship,
    et.parent_id
  FROM endeavor_tree et
  ORDER BY et.depth, et.endeavor_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Get context subgraph (endeavors visible in a specific context)
CREATE OR REPLACE FUNCTION get_context_subgraph(
  p_user_id uuid,
  p_context_id text
)
RETURNS TABLE(
  endeavor_id text,
  access_type text,
  depth int,
  relationship text,
  ui_type text,
  ui_label text
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  context_rec contexts%ROWTYPE;
  traversal_rules jsonb;
  max_depth int;
  follow_relationships text[];
BEGIN
  -- 1. Verify user has access to context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id AND cm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to context %', p_context_id;
  END IF;

  -- 2. Get context configuration
  SELECT * INTO context_rec
  FROM contexts c
  WHERE c.id = p_context_id AND c.archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Context % not found or archived', p_context_id;
  END IF;

  -- 3. Extract traversal rules
  traversal_rules := context_rec.traversal_rules;
  max_depth := COALESCE((traversal_rules->>'max_depth')::int, 10);
  follow_relationships := ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(traversal_rules->'follow_relationships', '["supports", "refines"]'::jsonb)
    )
  );

  -- 4. Get accessible subgraph starting from context roots
  RETURN QUERY
  SELECT
    sg.endeavor_id,
    sg.access_type,
    sg.depth,
    sg.relationship,
    COALESCE(
      (context_rec.ui_config->'typeMappings'->>(sg.endeavor_id)),
      -- Default mapping based on depth if not explicitly set
      CASE sg.depth
        WHEN 0 THEN 'mission'
        WHEN 1 THEN 'aim'
        WHEN 2 THEN 'initiative'
        ELSE 'task'
      END
    ) as ui_type,
    COALESCE(
      (context_rec.ui_config->'labels'->>(
        COALESCE(
          (context_rec.ui_config->'typeMappings'->>(sg.endeavor_id)),
          CASE sg.depth
            WHEN 0 THEN 'mission'
            WHEN 1 THEN 'aim'
            WHEN 2 THEN 'initiative'
            ELSE 'task'
          END
        )
      )),
      -- Default labels
      CASE sg.depth
        WHEN 0 THEN 'Mission'
        WHEN 1 THEN 'Aim'
        WHEN 2 THEN 'Initiative'
        ELSE 'Task'
      END
    ) as ui_label
  FROM get_accessible_subgraph(
    p_user_id,
    context_rec.root_endeavor_ids,
    max_depth,
    follow_relationships
  ) sg
  ORDER BY sg.depth, sg.endeavor_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Helper function to add endeavor to context
CREATE OR REPLACE FUNCTION add_endeavor_to_context(
  p_context_id text,
  p_endeavor_id text,
  p_user_id uuid,
  p_ui_type text DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  context_rec contexts%ROWTYPE;
  updated_roots text[];
  updated_ui_config jsonb;
BEGIN
  -- 1. Verify user can edit this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
      AND cm.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to edit context %', p_context_id;
  END IF;

  -- 2. Verify user can access the endeavor
  IF NOT has_endeavor_access(p_user_id, p_endeavor_id, 'viewer') THEN
    RAISE EXCEPTION 'No access to endeavor %', p_endeavor_id;
  END IF;

  -- 3. Get current context
  SELECT * INTO context_rec
  FROM contexts c
  WHERE c.id = p_context_id;

  -- 4. Add to root_endeavor_ids if not already present
  IF NOT (p_endeavor_id = ANY(context_rec.root_endeavor_ids)) THEN
    updated_roots := context_rec.root_endeavor_ids || ARRAY[p_endeavor_id];

    UPDATE contexts
    SET root_endeavor_ids = updated_roots
    WHERE id = p_context_id;
  END IF;

  -- 5. Update UI type mapping if specified
  IF p_ui_type IS NOT NULL THEN
    updated_ui_config := jsonb_set(
      context_rec.ui_config,
      ARRAY['typeMappings', p_endeavor_id],
      to_jsonb(p_ui_type)
    );

    UPDATE contexts
    SET ui_config = updated_ui_config
    WHERE id = p_context_id;
  END IF;

  -- 6. Grant access to all context members
  INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
  SELECT
    p_endeavor_id,
    cm.user_id,
    CASE
      WHEN cm.role = 'owner' THEN 'editor'
      WHEN cm.role = 'editor' THEN 'editor'
      ELSE 'viewer'
    END,
    p_user_id,
    'context:' || p_context_id
  FROM context_memberships cm
  WHERE cm.context_id = p_context_id
    AND cm.user_id != p_user_id -- Don't duplicate existing access
  ON CONFLICT (endeavor_id, user_id, access_type, granted_via) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 4. Helper function to remove endeavor from context
CREATE OR REPLACE FUNCTION remove_endeavor_from_context(
  p_context_id text,
  p_endeavor_id text,
  p_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_roots text[];
  updated_ui_config jsonb;
BEGIN
  -- 1. Verify user can edit this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
      AND cm.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to edit context %', p_context_id;
  END IF;

  -- 2. Remove from root_endeavor_ids
  UPDATE contexts
  SET root_endeavor_ids = array_remove(root_endeavor_ids, p_endeavor_id)
  WHERE id = p_context_id;

  -- 3. Remove from UI type mappings
  UPDATE contexts
  SET ui_config = ui_config - ('typeMappings.' || p_endeavor_id)
  WHERE id = p_context_id;

  -- 4. Revoke context-granted access
  UPDATE endeavor_access
  SET revoked_at = now()
  WHERE endeavor_id = p_endeavor_id
    AND granted_via = 'context:' || p_context_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get endeavor details with context-aware metadata
CREATE OR REPLACE FUNCTION get_endeavor_with_context(
  p_user_id uuid,
  p_endeavor_id text,
  p_context_id text DEFAULT NULL
)
RETURNS TABLE(
  id text,
  title text,
  description text,
  status text,
  access_type text,
  ui_type text,
  ui_label text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  context_ui_config jsonb;
BEGIN
  -- Verify access
  IF NOT has_endeavor_access(p_user_id, p_endeavor_id, 'viewer') THEN
    RAISE EXCEPTION 'No access to endeavor %', p_endeavor_id;
  END IF;

  -- Get context UI config if specified
  IF p_context_id IS NOT NULL THEN
    SELECT c.ui_config INTO context_ui_config
    FROM contexts c
    JOIN context_memberships cm ON cm.context_id = c.id
    WHERE c.id = p_context_id AND cm.user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.status,
    ae.access_type,
    COALESCE(
      context_ui_config->'typeMappings'->>(e.id),
      'task' -- Default type
    )::text as ui_type,
    COALESCE(
      context_ui_config->'labels'->>(
        COALESCE(context_ui_config->'typeMappings'->>(e.id), 'task')
      ),
      'Task' -- Default label
    )::text as ui_label,
    e.metadata,
    e.created_at,
    e.updated_at
  FROM endeavors e
  JOIN get_accessible_endeavors(p_user_id) ae ON ae.endeavor_id = e.id
  WHERE e.id = p_endeavor_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_accessible_subgraph(uuid, text[], int, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_context_subgraph(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_endeavor_to_context(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_endeavor_from_context(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_endeavor_with_context(uuid, text, text) TO authenticated;