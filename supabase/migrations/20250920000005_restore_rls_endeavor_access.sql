-- Restore RLS on endeavor_access table and fix the policy properly

-- Re-enable RLS
ALTER TABLE endeavor_access ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they work correctly
DROP POLICY IF EXISTS "Users can view their own access grants" ON endeavor_access;
DROP POLICY IF EXISTS "Users can view access grants they made" ON endeavor_access;
DROP POLICY IF EXISTS "Users can grant access to endeavors they own or created" ON endeavor_access;

-- Recreate the necessary policies
CREATE POLICY "Users can view their own access grants" ON endeavor_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view access grants they made" ON endeavor_access
  FOR SELECT USING (auth.uid() = granted_by);

-- Create a more permissive INSERT policy that works for system operations
CREATE POLICY "Allow initial access control creation" ON endeavor_access
  FOR INSERT WITH CHECK (
    -- Allow if the user creating the access entry is the same as the user being granted access
    -- AND they are the creator of the endeavor (for initial access control creation)
    auth.uid() = user_id
    AND auth.uid() = granted_by
    AND access_type = 'owner'
    AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = endeavor_id AND e.user_id = auth.uid()
    )
  );