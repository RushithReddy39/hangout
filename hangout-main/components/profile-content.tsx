"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Save, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"

const INTERESTS_OPTIONS = [
  "Gaming",
  "Music",
  "Sports",
  "Movies",
  "Travel",
  "Food",
  "Art",
  "Tech",
  "Fitness",
  "Reading",
  "Photography",
  "Fashion",
  "Nature",
  "Cooking",
  "Dancing",
]

interface ProfileContentProps {
  profile: Profile
}

export function ProfileContent({ profile: initialProfile }: ProfileContentProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()

  const toggleInterest = (interest: string) => {
    const currentInterests = profile.interests || []
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter((i) => i !== interest)
      : [...currentInterests, interest]
    setProfile({ ...profile, interests: newInterests })
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        bio: profile.bio,
        interests: profile.interests,
        location_sharing_enabled: profile.location_sharing_enabled,
      })
      .eq("id", profile.id)

    if (error) {
      setMessage({ type: "error", text: "Failed to save changes" })
    } else {
      setMessage({ type: "success", text: "Profile updated successfully" })
      router.refresh()
    }

    setIsSaving(false)
  }

  const updateLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const supabase = createClient()
          await supabase
            .from("profiles")
            .update({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id)

          setProfile({
            ...profile,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          setMessage({ type: "success", text: "Location updated" })
        },
        () => {
          setMessage({ type: "error", text: "Could not get location" })
        },
      )
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Profile Header */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">{profile.display_name}</h2>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-foreground">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={profile.display_name}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-foreground">
              Bio
            </Label>
            <Textarea
              id="bio"
              value={profile.bio || ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Interests</Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS_OPTIONS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    profile.interests?.includes(interest)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-accent" : "text-destructive"}`}>
              {message.text}
            </p>
          )}

          <Button onClick={handleSave} disabled={isSaving} className="w-full bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Location Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-card-foreground">Share my location with friends</p>
              <p className="text-sm text-muted-foreground">Allow friends to see you on the map</p>
            </div>
            <Switch
              checked={profile.location_sharing_enabled}
              onCheckedChange={(checked) => setProfile({ ...profile, location_sharing_enabled: checked })}
            />
          </div>

          {profile.location_sharing_enabled && (
            <Button
              onClick={updateLocation}
              variant="outline"
              className="w-full border-border text-foreground bg-transparent"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Update Current Location
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
