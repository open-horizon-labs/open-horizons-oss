-- Add user nodes to support Log Mode UI
-- This creates user identity nodes in the graph for global daily logs

-- First, insert user nodes for all existing users
INSERT INTO public.endeavors (id, user_id, title, description, status, metadata)
SELECT 
  'user:' || auth.users.id::text as id,
  auth.users.id as user_id,
  COALESCE(auth.users.raw_user_meta_data->>'full_name', 'User') as title,
  'Global user node for daily logs and cross-endeavor work' as description,
  'active' as status,
  jsonb_build_object(
    'node_type', 'user',
    'is_system_node', true,
    'created_via', 'migration'
  ) as metadata
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.endeavors 
  WHERE id = 'user:' || auth.users.id::text
);

-- Add a role assertion marking these as 'user' type
INSERT INTO public.role_assertions (user_id, endeavor_id, role, context, confidence, source)
SELECT 
  auth.users.id as user_id,
  'user:' || auth.users.id::text as endeavor_id,
  'user' as role,
  'identity' as context,
  1.0 as confidence,
  'migration' as source
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_assertions 
  WHERE endeavor_id = 'user:' || auth.users.id::text 
    AND role = 'user'
    AND context = 'identity'
);

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql;