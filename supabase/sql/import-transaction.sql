-- Import transaction function for all-or-nothing imports
CREATE OR REPLACE FUNCTION execute_import_transaction(
  p_user_id uuid,
  p_import_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  action_item jsonb;
  role_item jsonb;
  edge_item jsonb;
  endeavor_data jsonb;
  result jsonb;
BEGIN
  -- Start transaction (function is automatically wrapped in transaction)
  
  -- Process endeavor actions (INSERT/UPDATE)
  FOR action_item IN SELECT jsonb_array_elements(p_import_data->'actions')
  LOOP
    endeavor_data := action_item->'endeavor';
    
    IF action_item->>'action' = 'INSERT' THEN
      INSERT INTO endeavors (
        id,
        user_id,
        title,
        description,
        status,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        endeavor_data->>'id',
        p_user_id,
        endeavor_data->>'title',
        endeavor_data->>'summary',
        'active',
        endeavor_data->'provenance' || jsonb_build_object(
          'slug', endeavor_data->>'slug',
          'body_md', endeavor_data->>'body_md',
          'tags', endeavor_data->'tags'
        ),
        NOW(),
        NOW()
      );
      
    ELSIF action_item->>'action' = 'UPDATE' THEN
      UPDATE endeavors 
      SET 
        title = endeavor_data->>'title',
        description = CASE 
          WHEN endeavor_data->>'summary' IS NOT NULL 
            AND length(endeavor_data->>'summary') > length(COALESCE(description, ''))
          THEN endeavor_data->>'summary'
          ELSE description
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || endeavor_data->'provenance' || jsonb_build_object(
          'slug', endeavor_data->>'slug',
          'body_md', endeavor_data->>'body_md',
          'tags', endeavor_data->'tags',
          'updated_by_import', NOW()
        ),
        updated_at = NOW()
      WHERE id = (action_item->>'matched_node_id') AND user_id = p_user_id;
      
      -- Verify the update succeeded
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to update endeavor: %', action_item->>'matched_node_id';
      END IF;
    END IF;
  END LOOP;
  
  -- Process role assertions
  FOR role_item IN SELECT jsonb_array_elements(p_import_data->'role_assertions')
  LOOP
    -- Verify endeavor exists
    IF NOT EXISTS (
      SELECT 1 FROM endeavors 
      WHERE id = role_item->>'node_id' AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Endeavor does not exist for role assertion: %', role_item->>'node_id';
    END IF;
    
    INSERT INTO role_assertions (
      user_id,
      endeavor_id,
      role,
      context,
      confidence,
      source,
      asserted_at
    ) VALUES (
      p_user_id,
      role_item->>'node_id',
      role_item->>'role',
      role_item->>'horizon',
      COALESCE((role_item->>'confidence')::real, 1.0),
      COALESCE(role_item->>'source', 'importer'),
      COALESCE((role_item->>'asserted_at')::timestamptz, NOW())
    )
    ON CONFLICT (user_id, endeavor_id, role, context)
    DO UPDATE SET
      confidence = GREATEST(role_assertions.confidence, EXCLUDED.confidence),
      asserted_at = EXCLUDED.asserted_at;
  END LOOP;
  
  -- Process edges
  FOR edge_item IN SELECT jsonb_array_elements(p_import_data->'edges')
  LOOP
    -- Verify both endeavors exist
    IF NOT EXISTS (
      SELECT 1 FROM endeavors 
      WHERE id = edge_item->>'from_id' AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Source endeavor does not exist for edge: %', edge_item->>'from_id';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM endeavors 
      WHERE id = edge_item->>'to_id' AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Target endeavor does not exist for edge: %', edge_item->>'to_id';
    END IF;
    
    INSERT INTO edges (
      user_id,
      from_endeavor_id,
      to_endeavor_id,
      relationship,
      weight,
      created_at,
      context,
      metadata
    ) VALUES (
      p_user_id,
      edge_item->>'from_id',
      edge_item->>'to_id',
      edge_item->>'kind',
      COALESCE((edge_item->>'confidence')::real, 1.0),
      COALESCE((edge_item->>'asserted_at')::timestamptz, NOW()),
      COALESCE(edge_item->>'context', ''),
      jsonb_build_object('source', COALESCE(edge_item->>'source', 'importer'))
    )
    ON CONFLICT (user_id, from_endeavor_id, to_endeavor_id, relationship, context)
    DO NOTHING; -- Ignore duplicates for edges
  END LOOP;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'Import completed successfully'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Any error will cause the entire transaction to roll back
    RAISE EXCEPTION 'Import transaction failed: %', SQLERRM;
END;
$$;