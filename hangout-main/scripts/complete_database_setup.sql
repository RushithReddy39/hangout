-- ============================================================================
-- COMPLETE DATABASE SETUP FOR FRIEND CHAT MAP APP
-- ============================================================================
-- This file contains all necessary database setup for Supabase
-- Run this entire file in your Supabase SQL Editor or any PostgreSQL database
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  interests TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  location_sharing_enabled BOOLEAN DEFAULT false,
  online_status TEXT DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Create conversations table for chat
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON profiles USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(latitude, longitude) WHERE location_sharing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);

-- ============================================================================
-- PART 3: CREATE HELPER FUNCTIONS (SECURITY DEFINER TO BYPASS RLS)
-- ============================================================================

-- Function to get user's conversation IDs without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_user_conversation_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = user_uuid;
$$;

-- Function to check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships 
    WHERE status = 'accepted' 
    AND ((requester_id = user1 AND addressee_id = user2) 
      OR (requester_id = user2 AND addressee_id = user1))
  );
$$;

-- Function to get or create a conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Look for existing 1-on-1 conversation between these users
  SELECT c.id INTO conv_id
  FROM conversations c
  WHERE c.is_group = false
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp1 
    WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
  )
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp2 
    WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
  )
  AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;

  -- If no existing conversation, create one
  IF conv_id IS NULL THEN
    INSERT INTO conversations (is_group) VALUES (false) RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, user1_id);
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, user2_id);
  END IF;

  RETURN conv_id;
END;
$$;

-- Function to count shared interests between users
CREATE OR REPLACE FUNCTION count_shared_interests(user1_interests TEXT[], user2_interests TEXT[])
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_length(
    ARRAY(SELECT UNNEST(user1_interests) INTERSECT SELECT UNNEST(user2_interests)),
    1
  ), 0);
$$;

-- ============================================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: CREATE RLS POLICIES
-- ============================================================================

-- --------------------------
-- PROFILES POLICIES
-- --------------------------
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

-- Anyone can view profiles (needed for friend discovery)
CREATE POLICY "profiles_select_all" ON profiles 
  FOR SELECT USING (true);

-- Users can only insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Users can only delete their own profile
CREATE POLICY "profiles_delete_own" ON profiles 
  FOR DELETE USING (auth.uid() = id);

-- --------------------------
-- FRIENDSHIPS POLICIES
-- --------------------------
DROP POLICY IF EXISTS "friendships_select_own" ON friendships;
DROP POLICY IF EXISTS "friendships_insert_own" ON friendships;
DROP POLICY IF EXISTS "friendships_update_involved" ON friendships;
DROP POLICY IF EXISTS "friendships_delete_own" ON friendships;

-- Users can see friendships they're involved in
CREATE POLICY "friendships_select_own" ON friendships 
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can only create friend requests as the requester
CREATE POLICY "friendships_insert_own" ON friendships 
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Both parties can update friendship (accept/reject)
CREATE POLICY "friendships_update_involved" ON friendships 
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Both parties can delete friendship
CREATE POLICY "friendships_delete_own" ON friendships 
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- --------------------------
-- CONVERSATIONS POLICIES
-- --------------------------
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_authenticated" ON conversations;
DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;

-- Users can see conversations they participate in (using helper function)
CREATE POLICY "conversations_select_participant" ON conversations 
  FOR SELECT USING (id IN (SELECT get_user_conversation_ids(auth.uid())));

-- Authenticated users can create conversations
CREATE POLICY "conversations_insert_authenticated" ON conversations 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update conversations they participate in
CREATE POLICY "conversations_update_participant" ON conversations 
  FOR UPDATE USING (id IN (SELECT get_user_conversation_ids(auth.uid())));

-- --------------------------
-- CONVERSATION PARTICIPANTS POLICIES
-- --------------------------
DROP POLICY IF EXISTS "participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "participants_insert_authenticated" ON conversation_participants;
DROP POLICY IF EXISTS "participants_update_own" ON conversation_participants;
DROP POLICY IF EXISTS "participants_delete_own" ON conversation_participants;

-- Users can see participants in their conversations (using helper function to avoid recursion)
CREATE POLICY "participants_select_own" ON conversation_participants 
  FOR SELECT USING (conversation_id IN (SELECT get_user_conversation_ids(auth.uid())));

-- Authenticated users can add participants
CREATE POLICY "participants_insert_authenticated" ON conversation_participants 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own participant record
CREATE POLICY "participants_update_own" ON conversation_participants 
  FOR UPDATE USING (user_id = auth.uid());

-- Users can remove themselves from conversations
CREATE POLICY "participants_delete_own" ON conversation_participants 
  FOR DELETE USING (user_id = auth.uid());

-- --------------------------
-- MESSAGES POLICIES
-- --------------------------
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;

-- Users can see messages in their conversations
CREATE POLICY "messages_select_participant" ON messages 
  FOR SELECT USING (conversation_id IN (SELECT get_user_conversation_ids(auth.uid())));

-- Users can send messages to conversations they're in
CREATE POLICY "messages_insert_participant" ON messages 
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- Users can edit their own messages
CREATE POLICY "messages_update_own" ON messages 
  FOR UPDATE USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "messages_delete_own" ON messages 
  FOR DELETE USING (auth.uid() = sender_id);

-- ============================================================================
-- PART 6: ENABLE REALTIME
-- ============================================================================

-- Enable realtime for necessary tables
-- Note: Run these one at a time if you get errors about table already being in publication
DO $$
BEGIN
  -- Try to add each table, ignore if already added
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================================================
-- PART 7: CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS friendships_updated_at ON friendships;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS messages_updated_at ON messages;
CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Your database is now ready to use with the Friend Chat Map application.
-- 
-- Tables created:
--   - profiles: User profiles with interests and location
--   - friendships: Friend requests and connections
--   - conversations: Chat conversations
--   - conversation_participants: Users in each conversation
--   - messages: Chat messages
--
-- Helper functions:
--   - get_user_conversation_ids(): Get user's conversation IDs (RLS safe)
--   - are_friends(): Check if two users are friends
--   - get_or_create_conversation(): Create or find existing chat
--   - count_shared_interests(): Count matching interests between users
--
-- All RLS policies are enabled for security.
-- Realtime is enabled for live updates.
-- ============================================================================
