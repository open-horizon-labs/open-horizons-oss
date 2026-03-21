-- Fix function security issues migration
-- Add search_path = '' to all functions for security

-- Fix user node functions from migration 20250918000005
ALTER FUNCTION public.create_user_node() SET search_path = '';
ALTER FUNCTION public.get_user_node_id(uuid) SET search_path = '';

-- Fix update_updated_at_column function (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
  END IF;
END $$;

-- Fix handle_updated_at function (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    ALTER FUNCTION public.handle_updated_at() SET search_path = '';
  END IF;
END $$;

-- Fix other functions by getting their actual signatures (if they exist)
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Fix all functions with mutable search_path
  FOR func_record IN
    SELECT
      proname,
      pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN (
      'cleanup_old_sync_logs',
      'check_cycle_would_be_created',
      'execute_import_transaction',
      'get_external_context_for_date',
      'update_entity_sync_timestamp',
      'update_parent_relationship_atomic'
    )
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''''',
                   func_record.proname, func_record.args);
  END LOOP;
END $$;