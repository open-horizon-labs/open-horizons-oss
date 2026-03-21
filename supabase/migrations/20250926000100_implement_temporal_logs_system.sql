-- Implement Temporal Logs System (Collapsed Migration)
-- Date: 2025-09-26
-- Replaces: 20250925000001, 20250925000003-5, 20250926000001-2, 20250926000010-11
-- Description: Complete temporal logs implementation with context-aware RLS

-- Drop existing inconsistent daily log tables
DROP TABLE IF EXISTS public.daily_entries CASCADE;
DROP TABLE IF EXISTS public.daily_pages CASCADE;

-- Create new unified temporal logs table
CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Entity reference (exactly one)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('endeavor', 'context')),
    entity_id TEXT NOT NULL,

    -- Temporal (simplified approach)
    log_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Content
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'plain')),

    -- Adaptive metadata handles everything else
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes optimized for alignment queries
CREATE INDEX logs_user_entity_date_idx ON public.logs (user_id, entity_type, entity_id, log_date DESC);
CREATE INDEX logs_user_date_idx ON public.logs (user_id, log_date DESC);

-- Enable RLS on logs table
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (safety)
DROP POLICY IF EXISTS "Users can access their own logs" ON public.logs;
DROP POLICY IF EXISTS "Users can create logs for accessible entities" ON public.logs;
DROP POLICY IF EXISTS "Users can view logs for accessible entities" ON public.logs;
DROP POLICY IF EXISTS "Users can update their logs for accessible entities" ON public.logs;
DROP POLICY IF EXISTS "Users can delete their logs for accessible entities" ON public.logs;
DROP POLICY IF EXISTS "Users can delete logs they created" ON public.logs;
DROP POLICY IF EXISTS "Users can modify logs they created" ON public.logs;

-- 1. SELECT policy: Users can view logs for contexts they have access to
CREATE POLICY "Users can view logs for accessible contexts" ON public.logs
  FOR SELECT USING (
    -- For endeavor logs: user must have access to the endeavor's context
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON e.context_id = cm.context_id
      WHERE e.id = entity_id AND cm.user_id = auth.uid()
    ))
    OR
    -- For context logs: user must be a member of that context
    (entity_type = 'context' AND EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
    ))
  );

-- 2. INSERT policy: Users can create logs for contexts they have access to
CREATE POLICY "Users can create logs for accessible contexts" ON public.logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- For endeavor logs: user must have access to the endeavor's context
      (entity_type = 'endeavor' AND EXISTS (
        SELECT 1 FROM endeavors e
        JOIN context_memberships cm ON e.context_id = cm.context_id
        WHERE e.id = entity_id AND cm.user_id = auth.uid()
      ))
      OR
      -- For context logs: user must be a member of that context
      (entity_type = 'context' AND EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
      ))
    )
  );

-- 3. UPDATE policy: Users can update logs for contexts they have access to
-- IMPORTANT: Anyone with context access can update logs, not just the creator
CREATE POLICY "Users can update logs for accessible contexts" ON public.logs
  FOR UPDATE USING (
    -- For endeavor logs: user must have access to the endeavor's context
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON e.context_id = cm.context_id
      WHERE e.id = entity_id AND cm.user_id = auth.uid()
    ))
    OR
    -- For context logs: user must be a member of that context
    (entity_type = 'context' AND EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
    ))
  );

-- 4. DELETE policy: Users can delete logs for contexts they have access to
-- IMPORTANT: Anyone with context access can delete logs, not just the creator
CREATE POLICY "Users can delete logs for accessible contexts" ON public.logs
  FOR DELETE USING (
    -- For endeavor logs: user must have access to the endeavor's context
    (entity_type = 'endeavor' AND EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON e.context_id = cm.context_id
      WHERE e.id = entity_id AND cm.user_id = auth.uid()
    ))
    OR
    -- For context logs: user must be a member of that context
    (entity_type = 'context' AND EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = entity_id AND cm.user_id = auth.uid()
    ))
  );

-- Grant permissions
GRANT ALL ON public.logs TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;