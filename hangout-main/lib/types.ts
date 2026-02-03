export interface Profile {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  interests: string[]
  latitude: number | null
  longitude: number | null
  location_updated_at: string | null
  location_sharing_enabled: boolean
  online_status: "online" | "offline" | "away"
  last_seen: string
  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted" | "rejected" | "blocked"
  created_at: string
  updated_at: string
  requester?: Profile
  addressee?: Profile
}

export interface Conversation {
  id: string
  is_group: boolean
  name: string | null
  created_at: string
  updated_at: string
  participants?: ConversationParticipant[]
  last_message?: Message
}

export interface ConversationParticipant {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  profile?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: "text" | "image" | "location"
  created_at: string
  updated_at: string
  sender?: Profile
}
