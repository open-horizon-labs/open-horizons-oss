-- Parent Relationship Optimizations
-- This file contains optimized database functions for parent relationship management

-- Function to check if creating a parent relationship would create a cycle
-- Returns rows if a cycle would be created, empty if safe
CREATE OR REPLACE FUNCTION check_cycle_would_be_created(
  p_user_id UUID,
  p_child_id TEXT,
  p_proposed_parent_id TEXT
)
RETURNS TABLE(descendant_id TEXT) AS $$
BEGIN
  -- Use recursive CTE to find all descendants of the child
  -- If the proposed parent is among the descendants, it would create a cycle
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Base case: direct children of the endeavor
    SELECT from_endeavor_id as descendant_id
    FROM edges
    WHERE to_endeavor_id = p_child_id
      AND user_id = p_user_id
      AND relationship = 'supports'

    UNION

    -- Recursive case: children of children
    SELECT e.from_endeavor_id
    FROM edges e
    INNER JOIN descendants d ON e.to_endeavor_id = d.descendant_id
    WHERE e.user_id = p_user_id
      AND e.relationship = 'supports'
  )
  SELECT d.descendant_id
  FROM descendants d
  WHERE d.descendant_id = p_proposed_parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically update parent relationship
-- Removes old parent and sets new parent in a single transaction
CREATE OR REPLACE FUNCTION update_parent_relationship_atomic(
  p_user_id UUID,
  p_endeavor_id TEXT,
  p_new_parent_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Start transaction (function is automatically wrapped in transaction)

  -- Remove existing parent relationship
  DELETE FROM edges
  WHERE user_id = p_user_id
    AND from_endeavor_id = p_endeavor_id
    AND relationship = 'supports';

  -- Create new parent relationship if specified
  IF p_new_parent_id IS NOT NULL THEN
    INSERT INTO edges (
      user_id,
      from_endeavor_id,
      to_endeavor_id,
      relationship,
      weight
    ) VALUES (
      p_user_id,
      p_endeavor_id,
      p_new_parent_id,
      'supports',
      1.0
    );
  END IF;

  -- Function automatically commits transaction on success
  -- or rolls back on any error
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_cycle_would_be_created(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_parent_relationship_atomic(UUID, TEXT, TEXT) TO authenticated;