"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Navigation, RefreshCw, X, MessageCircle, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

interface FriendsMapProps {
  currentUser: Profile
  friends: Profile[]
}

export function FriendsMap({ currentUser, friends: initialFriends }: FriendsMapProps) {
  const [friends, setFriends] = useState(initialFriends)
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    currentUser.latitude && currentUser.longitude ? { lat: currentUser.latitude, lng: currentUser.longitude } : null,
  )
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 })
  const router = useRouter()

  // Calculate map bounds and center based on all locations
  useEffect(() => {
    const allLocations: { lat: number; lng: number }[] = []

    if (userLocation) {
      allLocations.push(userLocation)
    }

    friends.forEach((f) => {
      if (f.latitude && f.longitude) {
        allLocations.push({ lat: f.latitude, lng: f.longitude })
      }
    })

    if (allLocations.length > 0) {
      const avgLat = allLocations.reduce((sum, loc) => sum + loc.lat, 0) / allLocations.length
      const avgLng = allLocations.reduce((sum, loc) => sum + loc.lng, 0) / allLocations.length
      setMapCenter({ lat: avgLat, lng: avgLng })
    }
  }, [userLocation, friends])

  const updateMyLocation = useCallback(async () => {
    if (!("geolocation" in navigator)) return

    setIsUpdatingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        const supabase = createClient()
        await supabase
          .from("profiles")
          .update({
            latitude,
            longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id)

        setUserLocation({ lat: latitude, lng: longitude })
        setIsUpdatingLocation(false)
      },
      () => {
        setIsUpdatingLocation(false)
      },
      { enableHighAccuracy: true },
    )
  }, [currentUser.id])

  // Subscribe to location updates from friends
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("friend-locations")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const updated = payload.new as Profile
          setFriends((prev) =>
            prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)).filter((f) => f.location_sharing_enabled),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const startChat = async (friendId: string) => {
    const supabase = createClient()

    // Check existing conversations
    const { data: myConversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUser.id)

    if (myConversations?.length) {
      const conversationIds = myConversations.map((c) => c.conversation_id)
      const { data: friendConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", friendId)
        .in("conversation_id", conversationIds)

      if (friendConvs?.length) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", friendConvs[0].conversation_id)
          .eq("is_group", false)
          .single()

        if (conv) {
          router.push(`/chat/${conv.id}`)
          return
        }
      }
    }

    // Create new conversation
    const { data: newConv } = await supabase.from("conversations").insert({ is_group: false }).select().single()

    if (newConv) {
      await supabase.from("conversation_participants").insert([
        { conversation_id: newConv.id, user_id: currentUser.id },
        { conversation_id: newConv.id, user_id: friendId },
      ])
      router.push(`/chat/${newConv.id}`)
    }
  }

  // Convert lat/lng to x/y position on the map
  const getPosition = (lat: number, lng: number) => {
    // Simple projection for demo - normalize to map dimensions
    const x = ((lng - mapCenter.lng + 180) % 360) / 360
    const y = (mapCenter.lat - lat + 90) / 180

    return {
      x: Math.max(0.05, Math.min(0.95, 0.5 + (x - 0.5) * 20)),
      y: Math.max(0.05, Math.min(0.95, 0.5 + (y - 0.5) * 20)),
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Friends Map</h1>
          <p className="text-muted-foreground mt-1">See where your friends are hanging out</p>
        </div>
        {currentUser.location_sharing_enabled && (
          <Button
            onClick={updateMyLocation}
            disabled={isUpdatingLocation}
            variant="outline"
            className="border-border text-foreground bg-transparent"
          >
            {isUpdatingLocation ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4 mr-2" />
            )}
            Update My Location
          </Button>
        )}
      </div>

      {/* Map Container */}
      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[16/9] bg-secondary/50 min-h-[400px]">
            {/* Map Grid Background */}
            <div className="absolute inset-0 opacity-30">
              <svg className="w-full h-full">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Current User Marker */}
            {userLocation && currentUser.location_sharing_enabled && (
              <div
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  left: `${getPosition(userLocation.lat, userLocation.lng).x * 100}%`,
                  top: `${getPosition(userLocation.lat, userLocation.lng).y * 100}%`,
                }}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary border-4 border-card flex items-center justify-center shadow-lg">
                    <span className="text-primary-foreground font-bold text-sm">YOU</span>
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-primary" />
                </div>
              </div>
            )}

            {/* Friend Markers */}
            {friends.map((friend) => {
              if (!friend.latitude || !friend.longitude) return null
              const pos = getPosition(friend.latitude, friend.longitude)
              const isOnline = friend.online_status === "online"

              return (
                <div
                  key={friend.id}
                  className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110"
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                  }}
                  onClick={() => setSelectedFriend(friend)}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10 border-3 border-card shadow-lg">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback className="bg-accent text-accent-foreground">
                        {friend.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                        isOnline ? "bg-online" : "bg-offline"
                      }`}
                    />
                  </div>
                </div>
              )
            })}

            {/* Empty State */}
            {friends.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-card-foreground">No friends sharing location</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask your friends to enable location sharing to see them on the map
                  </p>
                </div>
              </div>
            )}

            {/* Selected Friend Card */}
            {selectedFriend && (
              <div className="absolute bottom-4 left-4 right-4 z-30 max-w-sm mx-auto">
                <Card className="border-border shadow-xl">
                  <CardContent className="p-4">
                    <button
                      onClick={() => setSelectedFriend(null)}
                      className="absolute top-2 right-2 p-1 hover:bg-secondary rounded"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={selectedFriend.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedFriend.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-card-foreground truncate">{selectedFriend.display_name}</h3>
                        <p className="text-sm text-muted-foreground">@{selectedFriend.username}</p>
                        {selectedFriend.location_updated_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Location updated{" "}
                            {formatDistanceToNow(new Date(selectedFriend.location_updated_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() => startChat(selectedFriend.id)}
                        className="flex-1 bg-primary text-primary-foreground"
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" /> Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Sharing Prompt */}
      {!currentUser.location_sharing_enabled && (
        <Card className="border-border border-dashed">
          <CardContent className="p-6 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-card-foreground">Enable Location Sharing</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Turn on location sharing in your profile to appear on your friends' maps
            </p>
            <Button
              onClick={() => router.push("/profile")}
              variant="outline"
              className="border-border text-foreground bg-transparent"
            >
              Go to Profile Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card className="border-border">
        <CardContent className="p-4">
          <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Friends Sharing Location ({friends.length})
          </h3>
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedFriend(friend)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {friend.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{friend.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {friend.location_updated_at
                        ? `Updated ${formatDistanceToNow(new Date(friend.location_updated_at), { addSuffix: true })}`
                        : "Location shared"}
                    </p>
                  </div>
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              None of your friends are sharing their location yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
