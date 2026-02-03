-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- Friendships policies
CREATE POLICY "friendships_select_own" ON friendships FOR SELECT 
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert_own" ON friendships FOR INSERT 
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update_involved" ON friendships FOR UPDATE 
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_delete_own" ON friendships FOR DELETE 
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Conversations policies - users can see conversations they're part of
CREATE POLICY "conversations_select_participant" ON conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversations.id AND user_id = auth.uid()
  ));
CREATE POLICY "conversations_insert_authenticated" ON conversations FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "conversations_update_participant" ON conversations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversations.id AND user_id = auth.uid()
  ));

-- Conversation participants policies
CREATE POLICY "participants_select_own" ON conversation_participants FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM conversation_participants cp 
    WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid()
  ));
CREATE POLICY "participants_insert_authenticated" ON conversation_participants FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "participants_delete_own" ON conversation_participants FOR DELETE 
  USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
  ));
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "messages_update_own" ON messages FOR UPDATE 
  USING (auth.uid() = sender_id);
CREATE POLICY "messages_delete_own" ON messages FOR DELETE 
  USING (auth.uid() = sender_id);
