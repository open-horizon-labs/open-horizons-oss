-- Function to delete ALL user data - DANGER ZONE
CREATE OR REPLACE FUNCTION delete_all_user_data(
  p_user_id uuid,
  p_confirm_text text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Double-check confirmation text
  IF p_confirm_text != 'YES I AM SURE' THEN
    RAISE EXCEPTION 'Invalid confirmation text. Data deletion aborted.';
  END IF;
  
  -- Start transaction (function is automatically wrapped in transaction)
  
  -- Delete all endeavor-related data (cascading will handle role_assertions and edges)
  DELETE FROM endeavors WHERE user_id = p_user_id;
  
  -- Delete all legacy artifacts (if any remain)
  DELETE FROM artifacts WHERE user_id = p_user_id;
  
  -- Delete all daily pages
  DELETE FROM daily_pages WHERE user_id = p_user_id;
  
  -- Delete waitlist entry (if exists)
  DELETE FROM waitlist WHERE email IN (
    SELECT email FROM auth.users WHERE id = p_user_id
  );
  
  -- Log the deletion (optional - for audit purposes)
  -- Could insert into an audit table here if needed
  
  -- The function will automatically commit if no errors occur
  -- or rollback if any error is raised
  
END;
$$;

-- Add comment to make it clear this is dangerous
COMMENT ON FUNCTION delete_all_user_data(uuid, text) IS 
'DANGER: Permanently deletes ALL user data. Cannot be undone. Requires confirmation text.';