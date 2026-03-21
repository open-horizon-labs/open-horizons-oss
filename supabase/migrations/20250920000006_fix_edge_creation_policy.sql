-- Fix edge creation policy to allow initial edge creation during endeavor setup

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create edges for endeavors they can edit" ON edges;

-- Create a more permissive INSERT policy for initial edge creation
CREATE POLICY "Users can create edges for their endeavors" ON edges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Allow if user owns/created both endeavors
      (EXISTS (SELECT 1 FROM endeavors e WHERE e.id = from_endeavor_id AND e.user_id = auth.uid()))
      AND
      (EXISTS (SELECT 1 FROM endeavors e WHERE e.id = to_endeavor_id AND e.user_id = auth.uid()))
    )
  );