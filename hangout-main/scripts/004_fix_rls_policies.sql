-- Fix infinite recursion in conversation_participants RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "participants_select_own" ON conversation_participants;

-- Create a simpler policy that doesn't cause infinite recursion
-- Users can see all participants in conversations they belong to
-- We use a security definer function to bypass RLS during the check
CREATE OR REPLACE FUNCTION get_user_conversation_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = user_uuid;
$$;

-- New policy uses the security definer function to avoid recursion
CREATE POLICY "participants_select_own" ON conversation_participants FOR SELECT
  USING (
    conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- Also fix conversations policy to use the same function
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;

CREATE POLICY "conversations_select_participant" ON conversations FOR SELECT
  USING (id IN (SELECT get_user_conversation_ids(auth.uid())));

CREATE POLICY "conversations_update_participant" ON conversations FOR UPDATE
  USING (id IN (SELECT get_user_conversation_ids(auth.uid())));

-- Fix messages policy similarly
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;

CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  USING (conversation_id IN (SELECT get_user_conversation_ids(auth.uid())));

CREATE POLICY "messages_insert_participant" ON messages FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );
