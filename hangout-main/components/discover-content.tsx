"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, UserPlus, Sparkles, Check } from "lucide-react"

interface DiscoverContentProps {
  currentUser: Profile
  suggestedProfiles: Profile[]
}

export function DiscoverContent({ currentUser, suggestedProfiles }: DiscoverContentProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<"similar" | "search">("similar")

  // Filter profiles by similar interests
  const similarProfiles = useMemo(() => {
    if (!currentUser.interests?.length) return suggestedProfiles

    return suggestedProfiles
      .map((profile) => {
        const sharedInterests = profile.interests?.filter((i) => currentUser.interests?.includes(i)) || []
        return { ...profile, sharedCount: sharedInterests.length, sharedInterests }
      })
      .filter((p) => p.sharedCount > 0)
      .sort((a, b) => b.sharedCount - a.sharedCount)
  }, [suggestedProfiles, currentUser.interests])

  const searchByUsername = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    const supabase = createClient()

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${searchQuery.toLowerCase()}%`)
      .neq("id", currentUser.id)
      .limit(20)

    setSearchResults((data as Profile[]) || [])
    setIsSearching(false)
    setActiveTab("search")
  }

  const sendFriendRequest = async (addresseeId: string) => {
    const supabase = createClient()

    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUser.id,
      addressee_id: addresseeId,
      status: "pending",
    })

    if (!error) {
      setSentRequests((prev) => new Set([...prev, addresseeId]))
    }
  }

  const ProfileCard = ({ profile, sharedInterests }: { profile: Profile; sharedInterests?: string[] }) => {
    const isSent = sentRequests.has(profile.id)

    return (
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14 flex-shrink-0">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-card-foreground truncate">{profile.display_name}</h3>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>}
              {sharedInterests && sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sharedInterests.slice(0, 4).map((interest) => (
                    <span key={interest} className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent">
                      {interest}
                    </span>
                  ))}
                  {sharedInterests.length > 4 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
                      +{sharedInterests.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => sendFriendRequest(profile.id)}
              disabled={isSent}
              className={isSent ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}
            >
              {isSent ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Sent
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1" /> Add
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discover Friends</h1>
        <p className="text-muted-foreground mt-1">Find people with similar interests or search by username</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchByUsername()}
            className="pl-9 bg-input border-border"
          />
        </div>
        <Button onClick={searchByUsername} disabled={isSearching} className="bg-primary text-primary-foreground">
          {isSearching ? "..." : "Search"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("similar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "similar"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Similar Interests ({similarProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Search Results ({searchResults.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === "similar" ? (
        <div className="space-y-3">
          {similarProfiles.length > 0 ? (
            similarProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                sharedInterests={(profile as { sharedInterests?: string[] }).sharedInterests}
              />
            ))
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-card-foreground">No matches yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try searching for friends by username or update your interests in your profile
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.length > 0 ? (
            searchResults.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-card-foreground">Search for friends</h3>
                <p className="text-sm text-muted-foreground mt-1">Enter a username to find people you know</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
