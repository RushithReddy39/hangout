"use client"

import type { Conversation, ConversationParticipant, Profile, Message } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

interface ChatListProps {
  currentUserId: string
  conversations: (Conversation & {
    participants: (ConversationParticipant & { profile: Profile })[]
    last_message?: Message
  })[]
}

export function ChatList({ currentUserId, conversations }: ChatListProps) {
  const getOtherParticipant = (
    conv: Conversation & { participants: (ConversationParticipant & { profile: Profile })[] },
  ) => {
    return conv.participants.find((p) => p.user_id !== currentUserId)?.profile
  }

  const getConversationName = (
    conv: Conversation & { participants: (ConversationParticipant & { profile: Profile })[] },
  ) => {
    if (conv.is_group && conv.name) return conv.name
    const other = getOtherParticipant(conv)
    return other?.display_name || "Unknown"
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground mt-1">Your conversations with friends</p>
      </div>

      <div className="space-y-2">
        {conversations.length > 0 ? (
          conversations.map((conv) => {
            const other = getOtherParticipant(conv)
            const isOnline = other?.online_status === "online"

            return (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <Card className="border-border hover:bg-secondary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={other?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getConversationName(conv).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {!conv.is_group && (
                          <span
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${
                              isOnline ? "bg-online" : "bg-offline"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-card-foreground truncate">{getConversationName(conv)}</h3>
                          {conv.last_message && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                            </span>
                          )}
                        </div>
                        {conv.last_message ? (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {conv.last_message.sender_id === currentUserId ? "You: " : ""}
                            {conv.last_message.content}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60 italic mt-0.5">No messages yet</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        ) : (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-card-foreground">No conversations yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Start chatting with your friends to see them here</p>
              <Link href="/friends">
                <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  View Friends
                </button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
