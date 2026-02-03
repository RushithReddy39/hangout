"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Message, ConversationParticipant } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Send, Users } from "lucide-react"
import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"

interface ChatRoomProps {
  conversationId: string
  currentUser: Profile
  otherUser?: Profile
  isGroup: boolean
  groupName: string | null
  initialMessages: (Message & { sender: Profile })[]
  participants: (ConversationParticipant & { profile: Profile })[]
}

export function ChatRoom({
  conversationId,
  currentUser,
  otherUser,
  isGroup,
  groupName,
  initialMessages,
}: ChatRoomProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chatName = isGroup ? groupName || "Group Chat" : otherUser?.display_name || "Chat"
  const isOnline = !isGroup && otherUser?.online_status === "online"

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Get sender profile
          const { data: sender } = await supabase.from("profiles").select("*").eq("id", payload.new.sender_id).single()

          const newMsg = {
            ...payload.new,
            sender,
          } as Message & { sender: Profile }

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: newMessage.trim(),
        message_type: "text",
      })
      .select(
        `
        *,
        sender:profiles(*)
      `,
      )
      .single()

    if (!error && data) {
      // Optimistic update (realtime will also push)
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data as Message & { sender: Profile }]
      })
      setNewMessage("")
    }

    setIsSending(false)
  }

  const formatMessageDate = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, "h:mm a")
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`
    return format(d, "MMM d, h:mm a")
  }

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: (Message & { sender: Profile })[] }[] = []

    messages.forEach((msg) => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd")
      const existingGroup = groups.find((g) => g.date === dateKey)

      if (existingGroup) {
        existingGroup.messages.push(msg)
      } else {
        groups.push({ date: dateKey, messages: [msg] })
      }
    })

    return groups
  }

  const getDateLabel = (dateKey: string) => {
    const d = new Date(dateKey)
    if (isToday(d)) return "Today"
    if (isYesterday(d)) return "Yesterday"
    return format(d, "MMMM d, yyyy")
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={(!isGroup && otherUser?.avatar_url) || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {isGroup ? <Users className="w-5 h-5" /> : chatName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!isGroup && (
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                isOnline ? "bg-online" : "bg-offline"
              }`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">{chatName}</h2>
          <p className="text-xs text-muted-foreground">{isOnline ? "Online" : !isGroup ? "Offline" : ""}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground/70">Say hello to start the conversation!</p>
            </div>
          </div>
        ) : (
          groupMessagesByDate().map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 text-xs bg-secondary text-muted-foreground rounded-full">
                  {getDateLabel(group.date)}
                </span>
              </div>
              <div className="space-y-3">
                {group.messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser.id

                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`flex gap-2 max-w-[80%] ${isMine ? "flex-row-reverse" : ""}`}>
                        {!isMine && (
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={msg.sender?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {msg.sender?.display_name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-secondary text-secondary-foreground rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${isMine ? "text-right" : ""}`}>
                            {formatMessageDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-input border-border"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="bg-primary text-primary-foreground"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
