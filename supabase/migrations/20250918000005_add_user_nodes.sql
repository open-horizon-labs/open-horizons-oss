-- Add user nodes migration
-- This creates user identity nodes in the graph for global daily logs

-- Note: User node creation will be handled by backup restore
-- This migration only sets up the trigger for future users

-- Create a function to automatically create user nodes on signup
CREATE OR REPLACE FUNCTION create_user_node()
RETURNS trigger AS $$
BEGIN
  -- Create user endeavor node
  INSERT INTO public.endeavors (id, user_id, title, description, status, metadata)
  VALUES (
    'user:' || NEW.id::text,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'Global user node for daily logs and cross-endeavor work',
    'active',
    jsonb_build_object(
      'node_type', 'user',
      'is_system_node', true,
      'created_via', 'trigger'
    )
  );

  -- Create role assertion
  INSERT INTO public.role_assertions (user_id, endeavor_id, role, context, confidence, source)
  VALUES (
    NEW.id,
    'user:' || NEW.id::text,
    'user',
    'identity',
    1.0,
    'trigger'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger to auto-create user nodes on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_node();

-- Helper function to get user's identity node ID
CREATE OR REPLACE FUNCTION get_user_node_id(user_uuid uuid)
RETURNS text AS $$
BEGIN
  RETURN 'user:' || user_uuid::text;
END;
$$ LANGUAGE plpgsql SET search_path = '';