"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Friendship } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, X, MessageCircle, Users, Clock, UserCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface FriendsContentProps {
  currentUserId: string
  friendships: Friendship[]
}

export function FriendsContent({ currentUserId, friendships: initialFriendships }: FriendsContentProps) {
  const [friendships, setFriendships] = useState(initialFriendships)
  const router = useRouter()

  const acceptedFriends = friendships.filter((f) => f.status === "accepted")
  const pendingReceived = friendships.filter((f) => f.status === "pending" && f.addressee_id === currentUserId)
  const pendingSent = friendships.filter((f) => f.status === "pending" && f.requester_id === currentUserId)

  const getFriend = (friendship: Friendship): Profile | undefined => {
    if (friendship.requester_id === currentUserId) {
      return friendship.addressee
    }
    return friendship.requester
  }

  const handleAccept = async (friendshipId: string) => {
    const supabase = createClient()
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId)
    setFriendships((prev) => prev.map((f) => (f.id === friendshipId ? { ...f, status: "accepted" as const } : f)))
    router.refresh()
  }

  const handleReject = async (friendshipId: string) => {
    const supabase = createClient()
    await supabase.from("friendships").delete().eq("id", friendshipId)
    setFriendships((prev) => prev.filter((f) => f.id !== friendshipId))
  }

  const startChat = async (friendId: string) => {
    const supabase = createClient()

    // Check if conversation already exists
    const { data: existingConversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId)

    if (existingConversations?.length) {
      const conversationIds = existingConversations.map((c) => c.conversation_id)
      const { data: friendParticipation } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", friendId)
        .in("conversation_id", conversationIds)

      if (friendParticipation?.length) {
        // Get conversation that's not a group
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", friendParticipation[0].conversation_id)
          .eq("is_group", false)
          .single()

        if (conv) {
          router.push(`/chat/${conv.id}`)
          return
        }
      }
    }

    // Create new conversation
    const { data: newConversation } = await supabase.from("conversations").insert({ is_group: false }).select().single()

    if (newConversation) {
      await supabase.from("conversation_participants").insert([
        { conversation_id: newConversation.id, user_id: currentUserId },
        { conversation_id: newConversation.id, user_id: friendId },
      ])
      router.push(`/chat/${newConversation.id}`)
    }
  }

  const FriendCard = ({
    friendship,
    showActions,
  }: {
    friendship: Friendship
    showActions?: "accept" | "pending"
  }) => {
    const friend = getFriend(friendship)
    if (!friend) return null

    const isOnline = friend.online_status === "online"

    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-12 h-12">
                <AvatarImage src={friend.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {friend.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${
                  isOnline ? "bg-online" : "bg-offline"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-card-foreground truncate">{friend.display_name}</h3>
              <p className="text-sm text-muted-foreground">@{friend.username}</p>
            </div>
            <div className="flex gap-2">
              {showActions === "accept" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(friendship.id)}
                    className="bg-accent text-accent-foreground"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(friendship.id)}
                    className="border-border text-foreground bg-transparent"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
              {showActions === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="border-border text-muted-foreground bg-transparent"
                >
                  <Clock className="w-4 h-4 mr-1" /> Pending
                </Button>
              )}
              {!showActions && (
                <Button size="sm" onClick={() => startChat(friend.id)} className="bg-primary text-primary-foreground">
                  <MessageCircle className="w-4 h-4 mr-1" /> Chat
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Friends</h1>
          <p className="text-muted-foreground mt-1">Manage your connections</p>
        </div>
        <Link href="/discover">
          <Button className="bg-primary text-primary-foreground">
            <Users className="w-4 h-4 mr-2" /> Find Friends
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="friends" className="data-[state=active]:bg-card">
            <UserCheck className="w-4 h-4 mr-2" />
            Friends ({acceptedFriends.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-card">
            Requests ({pendingReceived.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="data-[state=active]:bg-card">
            Sent ({pendingSent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4 space-y-3">
          {acceptedFriends.length > 0 ? (
            acceptedFriends.map((f) => <FriendCard key={f.id} friendship={f} />)
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-card-foreground">No friends yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Start discovering people to connect with</p>
                <Link href="/discover">
                  <Button className="mt-4 bg-primary text-primary-foreground">Find Friends</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-3">
          {pendingReceived.length > 0 ? (
            pendingReceived.map((f) => <FriendCard key={f.id} friendship={f} showActions="accept" />)
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-card-foreground">No pending requests</h3>
                <p className="text-sm text-muted-foreground mt-1">Friend requests will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4 space-y-3">
          {pendingSent.length > 0 ? (
            pendingSent.map((f) => <FriendCard key={f.id} friendship={f} showActions="pending" />)
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-card-foreground">No sent requests</h3>
                <p className="text-sm text-muted-foreground mt-1">Requests you send will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
