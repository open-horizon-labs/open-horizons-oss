-- Fix user node function security issues
-- Ensure create_user_node and get_user_node_id have secure search_path

-- These functions were created in 20250918000005 but need search_path security
ALTER FUNCTION public.create_user_node() SET search_path = '';
ALTER FUNCTION public.get_user_node_id(uuid) SET search_path = '';