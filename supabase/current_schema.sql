


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_context_invitation"("p_token" "text", "p_accepter_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invitation_rec context_invitations%ROWTYPE;
  accepter_email text;
BEGIN
  -- 1. Get accepter's email from auth.users
  SELECT email INTO accepter_email
  FROM auth.users
  WHERE id = p_accepter_user_id;

  IF accepter_email IS NULL THEN
    RAISE EXCEPTION 'Accepter user not found';
  END IF;

  -- 2. Find invitation by token and validate
  SELECT * INTO invitation_rec
  FROM context_invitations ci
  WHERE ci.token = p_token
    AND ci.invitee_email = accepter_email
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- 3. Check if user is already a member of the context
  IF EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = invitation_rec.context_id
      AND cm.user_id = p_accepter_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this context';
  END IF;

  -- 4. Create context membership
  INSERT INTO context_memberships (
    context_id,
    user_id,
    role,
    invited_by,
    invitation_token
  ) VALUES (
    invitation_rec.context_id,
    p_accepter_user_id,
    invitation_rec.role,
    invitation_rec.inviter_user_id,
    p_token
  );

  -- 5. Mark invitation as accepted
  UPDATE context_invitations
  SET accepted_at = now()
  WHERE id = invitation_rec.id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."accept_context_invitation"("p_token" "text", "p_accepter_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_endeavor_to_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid", "p_ui_type" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  context_rec contexts%ROWTYPE;
  updated_roots text[];
  updated_ui_config jsonb;
BEGIN
  -- 1. Verify user can edit this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
      AND cm.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to edit context %', p_context_id;
  END IF;

  -- 2. Verify user can access the endeavor
  IF NOT has_endeavor_access(p_user_id, p_endeavor_id, 'viewer') THEN
    RAISE EXCEPTION 'No access to endeavor %', p_endeavor_id;
  END IF;

  -- 3. Get current context
  SELECT * INTO context_rec
  FROM contexts c
  WHERE c.id = p_context_id;

  -- 4. Add to root_endeavor_ids if not already present
  IF NOT (p_endeavor_id = ANY(context_rec.root_endeavor_ids)) THEN
    updated_roots := context_rec.root_endeavor_ids || ARRAY[p_endeavor_id];

    UPDATE contexts
    SET root_endeavor_ids = updated_roots
    WHERE id = p_context_id;
  END IF;

  -- 5. Update UI type mapping if specified
  IF p_ui_type IS NOT NULL THEN
    updated_ui_config := jsonb_set(
      context_rec.ui_config,
      ARRAY['typeMappings', p_endeavor_id],
      to_jsonb(p_ui_type)
    );

    UPDATE contexts
    SET ui_config = updated_ui_config
    WHERE id = p_context_id;
  END IF;

  -- 6. Grant access to all context members
  INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
  SELECT
    p_endeavor_id,
    cm.user_id,
    CASE
      WHEN cm.role = 'owner' THEN 'editor'
      WHEN cm.role = 'editor' THEN 'editor'
      ELSE 'viewer'
    END,
    p_user_id,
    'context:' || p_context_id
  FROM context_memberships cm
  WHERE cm.context_id = p_context_id
    AND cm.user_id != p_user_id -- Don't duplicate existing access
  ON CONFLICT (endeavor_id, user_id, access_type, granted_via) DO NOTHING;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_endeavor_to_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid", "p_ui_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_context_invitation"("p_context_id" "text", "p_inviter_user_id" "uuid", "p_invitee_email" "text") RETURNS TABLE("invitation_id" "text", "token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_invitation_id text;
  v_token text;
BEGIN
  -- Check if the user is the context owner
  IF NOT EXISTS (
    SELECT 1 FROM contexts c
    WHERE c.id = p_context_id
    AND c.created_by = p_inviter_user_id
  ) THEN
    RAISE EXCEPTION 'Only context owners can create invitations';
  END IF;

  -- Generate unique IDs
  v_invitation_id := 'inv:' || p_context_id || ':' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || substr(md5(random()::text), 1, 8);
  v_token := 'ct_' || substr(md5(random()::text || now()::text), 1, 32);

  -- Insert invitation
  INSERT INTO context_invitations (
    id,
    context_id,
    inviter_user_id,
    invitee_email,
    token,
    expires_at
  ) VALUES (
    v_invitation_id,
    p_context_id,
    p_inviter_user_id,
    p_invitee_email,
    v_token,
    NOW() + INTERVAL '7 days'
  );

  -- Return the invitation ID and token
  RETURN QUERY SELECT v_invitation_id, v_token;
END;
$$;


ALTER FUNCTION "public"."create_context_invitation"("p_context_id" "text", "p_inviter_user_id" "uuid", "p_invitee_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_node"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Create user endeavor node with proper columns
  INSERT INTO public.endeavors (id, user_id, created_by, title, description, status, metadata)
  VALUES (
    'user:' || NEW.id::text,
    NEW.id,
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

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_node"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_context_pending_invitations"("p_context_id" "text", "p_user_id" "uuid") RETURNS TABLE("id" "text", "context_id" "text", "context_title" "text", "context_description" "text", "role" "text", "inviter_email" "text", "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if user owns the context (simplified - no role column)
  IF NOT EXISTS (
    SELECT 1 FROM contexts c
    WHERE c.id = p_context_id
    AND c.created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only view invitations for contexts you own';
  END IF;

  -- Return pending invitations
  RETURN QUERY
  SELECT
    ci.id,
    ci.context_id,
    c.title as context_title,
    c.description as context_description,
    'member'::text as role, -- Always return 'member' since we removed roles
    (SELECT email FROM auth.users WHERE id = ci.inviter_user_id) as inviter_email,
    ci.created_at,
    ci.expires_at,
    ci.token
  FROM context_invitations ci
  JOIN contexts c ON c.id = ci.context_id
  WHERE ci.context_id = p_context_id
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > NOW()
  ORDER BY ci.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_context_pending_invitations"("p_context_id" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_endeavor_children_recursive"("root_endeavor_id" "text") RETURNS TABLE("endeavor_id" "text")
    LANGUAGE "sql"
    AS $$
  WITH RECURSIVE descendants AS (
    -- Start with direct children of root
    SELECT id as endeavor_id FROM endeavors WHERE parent_id = root_endeavor_id
    UNION ALL
    -- Find their children recursively
    SELECT e.id as endeavor_id
    FROM endeavors e
    JOIN descendants d ON e.parent_id = d.endeavor_id
  )
  SELECT endeavor_id FROM descendants;
$$;


ALTER FUNCTION "public"."get_endeavor_children_recursive"("root_endeavor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_endeavor_descendants"("root_endeavor_id" "text") RETURNS TABLE("endeavor_id" "text")
    LANGUAGE "sql"
    AS $$
  WITH RECURSIVE descendants AS (
    -- Start with the root endeavor
    SELECT id as endeavor_id FROM endeavors WHERE id = root_endeavor_id
    UNION ALL
    -- Find all children recursively
    SELECT e.id as endeavor_id
    FROM endeavors e
    JOIN descendants d ON e.parent_id = d.endeavor_id
  )
  SELECT endeavor_id FROM descendants;
$$;


ALTER FUNCTION "public"."get_endeavor_descendants"("root_endeavor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_contexts"("p_user_id" "uuid") RETURNS TABLE("id" "text", "title" "text", "description" "text", "created_by" "uuid", "created_at" timestamp with time zone, "ui_config" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  -- Get contexts user owns
  SELECT c.id, c.title, c.description, c.created_by, c.created_at, c.ui_config
  FROM contexts c
  WHERE c.created_by = p_user_id

  UNION

  -- Get contexts user is a member of
  SELECT c.id, c.title, c.description, c.created_by, c.created_at, c.ui_config
  FROM contexts c
  INNER JOIN context_memberships cm ON cm.context_id = c.id
  WHERE cm.user_id = p_user_id

  ORDER BY created_at DESC;
$$;


ALTER FUNCTION "public"."get_user_contexts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_node_id"("user_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN 'user:' || user_uuid::text;
END;
$$;


ALTER FUNCTION "public"."get_user_node_id"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_pending_invitations"("p_user_email" "text") RETURNS TABLE("id" "text", "context_id" "text", "context_title" "text", "context_description" "text", "role" "text", "inviter_email" "text", "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.context_id,
    ci.context_title,
    ci.context_description,
    ci.role,
    CAST(u.email AS text) as inviter_email, -- Explicit CAST to fix type mismatch
    ci.created_at,
    ci.expires_at,
    ci.token
  FROM context_invitations ci
  JOIN auth.users u ON u.id = ci.inviter_user_id
  WHERE ci.invitee_email = p_user_email
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > now()
  ORDER BY ci.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_pending_invitations"("p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_endeavor_from_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_roots text[];
  updated_ui_config jsonb;
BEGIN
  -- 1. Verify user can edit this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
      AND cm.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to edit context %', p_context_id;
  END IF;

  -- 2. Remove from root_endeavor_ids
  UPDATE contexts
  SET root_endeavor_ids = array_remove(root_endeavor_ids, p_endeavor_id)
  WHERE id = p_context_id;

  -- 3. Remove from UI type mappings
  UPDATE contexts
  SET ui_config = ui_config - ('typeMappings.' || p_endeavor_id)
  WHERE id = p_context_id;

  -- 4. Revoke context-granted access
  UPDATE endeavor_access
  SET revoked_at = now()
  WHERE endeavor_id = p_endeavor_id
    AND granted_via = 'context:' || p_context_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_endeavor_from_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_context_invitation"("p_invitation_id" "text", "p_revoker_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the user owns the context for this invitation
  IF NOT EXISTS (
    SELECT 1
    FROM context_invitations ci
    JOIN contexts c ON c.id = ci.context_id
    WHERE ci.id = p_invitation_id
      AND c.created_by = p_revoker_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only revoke invitations for contexts you own';
  END IF;

  -- Revoke the invitation
  UPDATE context_invitations
  SET revoked_at = NOW()
  WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  -- Check if any row was actually updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;
END;
$$;


ALTER FUNCTION "public"."revoke_context_invitation"("p_invitation_id" "text", "p_revoker_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "text" DEFAULT ('ak_'::"text" || ("gen_random_uuid"())::"text") NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY['read'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "api_keys_metadata_not_null" CHECK (("metadata" IS NOT NULL)),
    CONSTRAINT "api_keys_name_length" CHECK ((("char_length"("name") > 0) AND ("char_length"("name") <= 100)))
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."context_invitations" (
    "id" "text" NOT NULL,
    "context_id" "text" NOT NULL,
    "inviter_user_id" "uuid" NOT NULL,
    "invitee_email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context_title" "text",
    "context_description" "text",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    CONSTRAINT "context_invitations_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."context_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."context_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "invitation_token" "text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."context_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contexts" (
    "id" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "traversal_rules" "jsonb" DEFAULT '{"max_depth": 10, "follow_relationships": ["supports", "refines"]}'::"jsonb" NOT NULL,
    "ui_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."endeavors" (
    "id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_reason" "text",
    "node_type" "text" DEFAULT 'Task'::"text",
    "context_id" "text",
    "created_by" "uuid" NOT NULL,
    "parent_id" "text",
    CONSTRAINT "endeavors_node_type_check" CHECK (("node_type" = ANY (ARRAY['Mission'::"text", 'Aim'::"text", 'Initiative'::"text", 'Task'::"text", 'Ritual'::"text", 'Strength'::"text", 'Achievement'::"text", 'DailyPage'::"text"])))
);


ALTER TABLE "public"."endeavors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_account_id" "uuid" NOT NULL,
    "external_id" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "title" "text",
    "data" "jsonb" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."external_entities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "external_account_id" "text" NOT NULL,
    "access_token_encrypted" "text",
    "refresh_token_encrypted" "text",
    "account_info" "jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "pipedream_connection_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "integration_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."integration_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_entity_id" "uuid" NOT NULL,
    "internal_entity_type" "text" NOT NULL,
    "internal_entity_id" "text" NOT NULL,
    "link_type" "text" DEFAULT 'related'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "integration_links_internal_entity_type_check" CHECK (("internal_entity_type" = ANY (ARRAY['endeavor'::"text", 'daily_log'::"text"]))),
    CONSTRAINT "integration_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['related'::"text", 'sync'::"text", 'mirror'::"text"])))
);


ALTER TABLE "public"."integration_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "log_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" NOT NULL,
    "content_type" "text" DEFAULT 'markdown'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "logs_content_type_check" CHECK (("content_type" = ANY (ARRAY['markdown'::"text", 'plain'::"text"]))),
    CONSTRAINT "logs_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['endeavor'::"text", 'context'::"text"])))
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "about_me" "text",
    "llm_personalization" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE "public"."waitlist" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."waitlist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_name_user_unique" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_context_id_invitee_email_accepted_at_key" UNIQUE ("context_id", "invitee_email", "accepted_at");



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."context_memberships"
    ADD CONSTRAINT "context_memberships_context_id_user_id_key" UNIQUE ("context_id", "user_id");



ALTER TABLE ONLY "public"."context_memberships"
    ADD CONSTRAINT "context_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."endeavors"
    ADD CONSTRAINT "endeavors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_entities"
    ADD CONSTRAINT "external_entities_integration_account_id_external_id_entity_key" UNIQUE ("integration_account_id", "external_id", "entity_type");



ALTER TABLE ONLY "public"."external_entities"
    ADD CONSTRAINT "external_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_accounts"
    ADD CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_accounts"
    ADD CONSTRAINT "integration_accounts_user_id_service_name_key" UNIQUE ("user_id", "service_name");



ALTER TABLE ONLY "public"."integration_links"
    ADD CONSTRAINT "integration_links_external_entity_id_internal_entity_type_i_key" UNIQUE ("external_entity_id", "internal_entity_type", "internal_entity_id");



ALTER TABLE ONLY "public"."integration_links"
    ADD CONSTRAINT "integration_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "endeavors_active_idx" ON "public"."endeavors" USING "btree" ("user_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "endeavors_archived_at_idx" ON "public"."endeavors" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "endeavors_user_id_idx" ON "public"."endeavors" USING "btree" ("user_id");



CREATE INDEX "idx_api_keys_active" ON "public"."api_keys" USING "btree" ("user_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_api_keys_hash" ON "public"."api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_api_keys_last_used" ON "public"."api_keys" USING "btree" ("last_used_at");



CREATE INDEX "idx_api_keys_metadata" ON "public"."api_keys" USING "gin" ("metadata");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_context_invitations_active" ON "public"."context_invitations" USING "btree" ("context_id", "invitee_email") WHERE (("accepted_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_context_invitations_context" ON "public"."context_invitations" USING "btree" ("context_id");



CREATE INDEX "idx_context_invitations_email" ON "public"."context_invitations" USING "btree" ("invitee_email");



CREATE INDEX "idx_context_invitations_expires" ON "public"."context_invitations" USING "btree" ("expires_at");



CREATE INDEX "idx_context_invitations_token" ON "public"."context_invitations" USING "btree" ("token");



CREATE INDEX "idx_context_memberships_context_id" ON "public"."context_memberships" USING "btree" ("context_id");



CREATE INDEX "idx_context_memberships_invitation_token" ON "public"."context_memberships" USING "btree" ("invitation_token") WHERE ("invitation_token" IS NOT NULL);



CREATE INDEX "idx_context_memberships_user_id" ON "public"."context_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_contexts_active" ON "public"."contexts" USING "btree" ("created_by") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_contexts_created_by" ON "public"."contexts" USING "btree" ("created_by");



CREATE INDEX "idx_endeavors_context_id" ON "public"."endeavors" USING "btree" ("context_id");



CREATE INDEX "idx_endeavors_created_by" ON "public"."endeavors" USING "btree" ("created_by");



CREATE INDEX "idx_endeavors_parent_id" ON "public"."endeavors" USING "btree" ("parent_id");



CREATE INDEX "idx_external_entities_account_id" ON "public"."external_entities" USING "btree" ("integration_account_id");



CREATE INDEX "idx_external_entities_type" ON "public"."external_entities" USING "btree" ("entity_type");



CREATE INDEX "idx_integration_accounts_user_id" ON "public"."integration_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_integration_links_external_id" ON "public"."integration_links" USING "btree" ("external_entity_id");



CREATE INDEX "idx_integration_links_internal" ON "public"."integration_links" USING "btree" ("internal_entity_type", "internal_entity_id");



CREATE INDEX "logs_user_date_idx" ON "public"."logs" USING "btree" ("user_id", "log_date" DESC);



CREATE INDEX "logs_user_entity_date_idx" ON "public"."logs" USING "btree" ("user_id", "entity_type", "entity_id", "log_date" DESC);



CREATE INDEX "waitlist_email_idx" ON "public"."waitlist" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "handle_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."context_invitations"
    ADD CONSTRAINT "context_invitations_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."context_memberships"
    ADD CONSTRAINT "context_memberships_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."context_memberships"
    ADD CONSTRAINT "context_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."context_memberships"
    ADD CONSTRAINT "context_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."endeavors"
    ADD CONSTRAINT "endeavors_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."endeavors"
    ADD CONSTRAINT "endeavors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."endeavors"
    ADD CONSTRAINT "endeavors_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."endeavors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."external_entities"
    ADD CONSTRAINT "external_entities_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_accounts"
    ADD CONSTRAINT "integration_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_links"
    ADD CONSTRAINT "integration_links_external_entity_id_fkey" FOREIGN KEY ("external_entity_id") REFERENCES "public"."external_entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous inserts" ON "public"."waitlist" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow service role read" ON "public"."waitlist" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Context creators can update their contexts" ON "public"."contexts" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Context owners can create invitations" ON "public"."context_invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."endeavors" "e"
  WHERE (("e"."id" = "context_invitations"."context_id") AND ((("e"."metadata" -> 'participants'::"text") @> "jsonb_build_array"("jsonb_build_object"('userId', ("auth"."uid"())::"text", 'role', 'owner'))) OR (("e"."metadata" -> 'participants'::"text") @> "jsonb_build_array"("jsonb_build_object"('userId', ("auth"."uid"())::"text", 'role', 'editor'))))))));



CREATE POLICY "Enable insert for owners" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read for owners" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable update for owners" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can accept invitations to their email" ON "public"."context_invitations" FOR UPDATE USING (true);



CREATE POLICY "Users can create contexts" ON "public"."contexts" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create endeavors" ON "public"."endeavors" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create logs for accessible contexts" ON "public"."logs" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ((("entity_type" = 'endeavor'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."endeavors" "e"
     JOIN "public"."context_memberships" "cm" ON (("e"."context_id" = "cm"."context_id")))
  WHERE (("e"."id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("entity_type" = 'context'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."context_memberships" "cm"
  WHERE (("cm"."context_id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can create their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete logs for accessible contexts" ON "public"."logs" FOR DELETE USING (((("entity_type" = 'endeavor'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."endeavors" "e"
     JOIN "public"."context_memberships" "cm" ON (("e"."context_id" = "cm"."context_id")))
  WHERE (("e"."id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("entity_type" = 'context'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."context_memberships" "cm"
  WHERE (("cm"."context_id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can manage own integration accounts" ON "public"."integration_accounts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own integration links" ON "public"."integration_links" USING (("external_entity_id" IN ( SELECT "ee"."id"
   FROM ("public"."external_entities" "ee"
     JOIN "public"."integration_accounts" "ia" ON (("ee"."integration_account_id" = "ia"."id")))
  WHERE ("ia"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update logs for accessible contexts" ON "public"."logs" FOR UPDATE USING (((("entity_type" = 'endeavor'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."endeavors" "e"
     JOIN "public"."context_memberships" "cm" ON (("e"."context_id" = "cm"."context_id")))
  WHERE (("e"."id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("entity_type" = 'context'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."context_memberships" "cm"
  WHERE (("cm"."context_id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their sent invitations" ON "public"."context_invitations" FOR UPDATE USING (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "Users can view invitations to their email" ON "public"."context_invitations" FOR SELECT USING (true);



CREATE POLICY "Users can view logs for accessible contexts" ON "public"."logs" FOR SELECT USING (((("entity_type" = 'endeavor'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."endeavors" "e"
     JOIN "public"."context_memberships" "cm" ON (("e"."context_id" = "cm"."context_id")))
  WHERE (("e"."id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"()))))) OR (("entity_type" = 'context'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."context_memberships" "cm"
  WHERE (("cm"."context_id" = "logs"."entity_id") AND ("cm"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view own external entities" ON "public"."external_entities" USING (("integration_account_id" IN ( SELECT "integration_accounts"."id"
   FROM "public"."integration_accounts"
  WHERE ("integration_accounts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own contexts" ON "public"."contexts" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can view their sent invitations" ON "public"."context_invitations" FOR SELECT USING (("auth"."uid"() = "inviter_user_id"));



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."context_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."context_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "context_memberships_access" ON "public"."context_memberships" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."contexts" "c"
  WHERE (("c"."id" = "context_memberships"."context_id") AND ("c"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."endeavors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "endeavors_context_access" ON "public"."endeavors" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."context_memberships" "cm"
  WHERE (("cm"."context_id" = "endeavors"."context_id") AND ("cm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."external_entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."accept_context_invitation"("p_token" "text", "p_accepter_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_context_invitation"("p_token" "text", "p_accepter_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_context_invitation"("p_token" "text", "p_accepter_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_endeavor_to_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid", "p_ui_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_endeavor_to_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid", "p_ui_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_endeavor_to_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid", "p_ui_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_context_invitation"("p_context_id" "text", "p_inviter_user_id" "uuid", "p_invitee_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_context_invitation"("p_context_id" "text", "p_inviter_user_id" "uuid", "p_invitee_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_context_invitation"("p_context_id" "text", "p_inviter_user_id" "uuid", "p_invitee_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_node"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_node"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_node"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_context_pending_invitations"("p_context_id" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_context_pending_invitations"("p_context_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_context_pending_invitations"("p_context_id" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_endeavor_children_recursive"("root_endeavor_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_endeavor_children_recursive"("root_endeavor_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_endeavor_children_recursive"("root_endeavor_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_endeavor_descendants"("root_endeavor_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_endeavor_descendants"("root_endeavor_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_endeavor_descendants"("root_endeavor_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_contexts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_contexts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_contexts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_node_id"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_node_id"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_node_id"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_pending_invitations"("p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_pending_invitations"("p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_pending_invitations"("p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_endeavor_from_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_endeavor_from_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_endeavor_from_context"("p_context_id" "text", "p_endeavor_id" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_context_invitation"("p_invitation_id" "text", "p_revoker_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_context_invitation"("p_invitation_id" "text", "p_revoker_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_context_invitation"("p_invitation_id" "text", "p_revoker_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."context_invitations" TO "anon";
GRANT ALL ON TABLE "public"."context_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."context_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."context_memberships" TO "anon";
GRANT ALL ON TABLE "public"."context_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."context_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."contexts" TO "anon";
GRANT ALL ON TABLE "public"."contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."contexts" TO "service_role";



GRANT ALL ON TABLE "public"."endeavors" TO "anon";
GRANT ALL ON TABLE "public"."endeavors" TO "authenticated";
GRANT ALL ON TABLE "public"."endeavors" TO "service_role";



GRANT ALL ON TABLE "public"."external_entities" TO "anon";
GRANT ALL ON TABLE "public"."external_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."external_entities" TO "service_role";



GRANT ALL ON TABLE "public"."integration_accounts" TO "anon";
GRANT ALL ON TABLE "public"."integration_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."integration_links" TO "anon";
GRANT ALL ON TABLE "public"."integration_links" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_links" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."waitlist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."waitlist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."waitlist_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
