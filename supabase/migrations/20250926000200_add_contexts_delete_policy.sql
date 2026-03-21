-- Add DELETE policy for contexts table to enable DELETE ALL functionality

-- Allow users to delete contexts they created
CREATE POLICY "Context creators can delete their contexts" ON contexts
  FOR DELETE USING (created_by = auth.uid());