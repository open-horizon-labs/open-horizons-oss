-- Fix logs RLS policy to handle personal contexts and simplified endeavor access
-- The original policy was using context_memberships which doesn't work for personal contexts
-- After context sharing simplification, endeavors have context_id column instead of endeavor_access table

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view logs for accessible contexts" ON public.logs;
DROP POLICY IF EXISTS "Users can create logs for accessible contexts" ON public.logs;
DROP POLICY IF EXISTS "Users can update logs for accessible contexts" ON public.logs;
DROP POLICY IF EXISTS "Users can delete logs for accessible contexts" ON public.logs;

-- 1. SELECT policy: Users can view logs for contexts they have access to
CREATE POLICY "Users can view logs for accessible contexts" ON public.logs
  FOR SELECT USING (
    -- For endeavor logs: check if user has access to the endeavor
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = entity_id
        AND (
          -- Direct ownership (created by user)
          e.created_by = auth.uid()
          OR
          -- Access via context membership (if endeavor is in a context)
          (e.context_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM context_memberships cm
            WHERE cm.context_id = e.context_id AND cm.user_id = auth.uid()
          ))
          OR
          -- Personal context access (if endeavor context is personal)
          e.context_id = 'personal:' || auth.uid()::text
        )
    ))
    OR
    -- For context logs: handle personal contexts and regular contexts differently
    (entity_type = 'context' AND (
      -- Personal context: user owns it (context_id = 'personal:user_id')
      entity_id = 'personal:' || auth.uid()::text
      OR
      -- Regular context: user owns it or is a member
      EXISTS (
        SELECT 1 FROM contexts c
        WHERE c.id = entity_id AND c.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
      )
    ))
  );

-- 2. INSERT policy: Users can create logs for contexts they have access to
CREATE POLICY "Users can create logs for accessible contexts" ON public.logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- For endeavor logs: check if user has access to the endeavor
      (entity_type = 'endeavor' AND EXISTS (
        SELECT 1 FROM endeavors e
        WHERE e.id = entity_id
          AND (
            -- Direct ownership (created by user)
            e.created_by = auth.uid()
            OR
            -- Access via context membership (if endeavor is in a context)
            (e.context_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM context_memberships cm
              WHERE cm.context_id = e.context_id AND cm.user_id = auth.uid()
            ))
            OR
            -- Personal context access (if endeavor context is personal)
            e.context_id = 'personal:' || auth.uid()::text
          )
      ))
      OR
      -- For context logs: handle personal contexts and regular contexts differently
      (entity_type = 'context' AND (
        -- Personal context: user owns it (context_id = 'personal:user_id')
        entity_id = 'personal:' || auth.uid()::text
        OR
        -- Regular context: user owns it or is a member
        EXISTS (
          SELECT 1 FROM contexts c
          WHERE c.id = entity_id AND c.created_by = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM context_memberships cm
          WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
        )
      ))
    )
  );

-- 3. UPDATE policy: Users can update logs for contexts they have access to
CREATE POLICY "Users can update logs for accessible contexts" ON public.logs
  FOR UPDATE USING (
    -- For endeavor logs: check if user has access to the endeavor
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = entity_id
        AND (
          -- Direct ownership (created by user)
          e.created_by = auth.uid()
          OR
          -- Access via context membership (if endeavor is in a context)
          (e.context_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM context_memberships cm
            WHERE cm.context_id = e.context_id AND cm.user_id = auth.uid()
          ))
          OR
          -- Personal context access (if endeavor context is personal)
          e.context_id = 'personal:' || auth.uid()::text
        )
    ))
    OR
    -- For context logs: handle personal contexts and regular contexts differently
    (entity_type = 'context' AND (
      -- Personal context: user owns it (context_id = 'personal:user_id')
      entity_id = 'personal:' || auth.uid()::text
      OR
      -- Regular context: user owns it or is a member
      EXISTS (
        SELECT 1 FROM contexts c
        WHERE c.id = entity_id AND c.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
      )
    ))
  );

-- 4. DELETE policy: Users can delete logs for contexts they have access to
CREATE POLICY "Users can delete logs for accessible contexts" ON public.logs
  FOR DELETE USING (
    -- For endeavor logs: check if user has access to the endeavor
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = entity_id
        AND (
          -- Direct ownership (created by user)
          e.created_by = auth.uid()
          OR
          -- Access via context membership (if endeavor is in a context)
          (e.context_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM context_memberships cm
            WHERE cm.context_id = e.context_id AND cm.user_id = auth.uid()
          ))
          OR
          -- Personal context access (if endeavor context is personal)
          e.context_id = 'personal:' || auth.uid()::text
        )
    ))
    OR
    -- For context logs: handle personal contexts and regular contexts differently
    (entity_type = 'context' AND (
      -- Personal context: user owns it (context_id = 'personal:user_id')
      entity_id = 'personal:' || auth.uid()::text
      OR
      -- Regular context: user owns it or is a member
      EXISTS (
        SELECT 1 FROM contexts c
        WHERE c.id = entity_id AND c.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
      )
    ))
  );