import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FriendsMap } from "@/components/friends-map"
import type { Profile } from "@/lib/types"

export default async function MapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) redirect("/profile/setup")

  // Get accepted friendships
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted")

  // Get friend IDs
  const friendIds =
    friendships?.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)).filter(Boolean) || []

  // Get friends who have location sharing enabled
  let friendsWithLocation: Profile[] = []
  if (friendIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds)
      .eq("location_sharing_enabled", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    friendsWithLocation = (data as Profile[]) || []
  }

  return (
    <AppShell currentUser={currentProfile as Profile}>
      <FriendsMap currentUser={currentProfile as Profile} friends={friendsWithLocation} />
    </AppShell>
  )
}
