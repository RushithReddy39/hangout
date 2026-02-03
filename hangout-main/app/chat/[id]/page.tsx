import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ChatRoom } from "@/components/chat-room"
import type { Profile, Message, ConversationParticipant } from "@/lib/types"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) redirect("/profile/setup")

  // Verify user is part of conversation
  const { data: participation } = await supabase
    .from("conversation_participants")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single()

  if (!participation) notFound()

  // Get conversation details
  const { data: conversation } = await supabase.from("conversations").select("*").eq("id", conversationId).single()

  if (!conversation) notFound()

  // Get all participants
  const { data: participants } = await supabase
    .from("conversation_participants")
    .select(
      `
      *,
      profile:profiles(*)
    `,
    )
    .eq("conversation_id", conversationId)

  // Get messages
  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:profiles(*)
    `,
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100)

  const otherParticipant = participants?.find((p) => p.user_id !== user.id)?.profile as Profile | undefined

  return (
    <ChatRoom
      conversationId={conversationId}
      currentUser={currentProfile as Profile}
      otherUser={otherParticipant}
      isGroup={conversation.is_group}
      groupName={conversation.name}
      initialMessages={(messages as (Message & { sender: Profile })[]) || []}
      participants={(participants as (ConversationParticipant & { profile: Profile })[]) || []}
    />
  )
}
