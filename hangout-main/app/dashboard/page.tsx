import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ChatList } from "@/components/chat-list"
import type { Profile, Conversation, ConversationParticipant, Message } from "@/lib/types"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) redirect("/profile/setup")

  // Get all conversations for current user
  const { data: participations } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id)

  let conversations: (Conversation & { participants: (ConversationParticipant & { profile: Profile })[] })[] = []

  if (participations?.length) {
    const conversationIds = participations.map((p) => p.conversation_id)

    const { data: convData } = await supabase.from("conversations").select("*").in("id", conversationIds)

    if (convData) {
      // Get participants for each conversation
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select(
          `
          *,
          profile:profiles(*)
        `,
        )
        .in("conversation_id", conversationIds)

      // Get last message for each conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })

      conversations = convData.map((conv) => ({
        ...conv,
        participants:
          (allParticipants
            ?.filter((p) => p.conversation_id === conv.id)
            .map((p) => ({
              ...p,
              profile: p.profile,
            })) as (ConversationParticipant & { profile: Profile })[]) || [],
        last_message: lastMessages?.find((m) => m.conversation_id === conv.id) as Message | undefined,
      }))

      // Sort by last message date
      conversations.sort((a, b) => {
        const aDate = a.last_message?.created_at || a.created_at
        const bDate = b.last_message?.created_at || b.created_at
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })
    }
  }

  return (
    <AppShell currentUser={currentProfile as Profile}>
      <ChatList currentUserId={user.id} conversations={conversations} />
    </AppShell>
  )
}
