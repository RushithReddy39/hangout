import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { DiscoverContent } from "@/components/discover-content"
import type { Profile } from "@/lib/types"

export default async function DiscoverPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Get current user's profile
  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) {
    redirect("/profile/setup")
  }

  // Get all profiles with similar interests, excluding current user and existing friends
  const { data: existingFriendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const friendIds =
    existingFriendships?.flatMap((f) => [f.requester_id, f.addressee_id]).filter((id) => id !== user.id) || []

  const { data: suggestedProfiles } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", user.id)
    .not("id", "in", `(${friendIds.length > 0 ? friendIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
    .limit(50)

  return (
    <AppShell currentUser={currentProfile as Profile}>
      <DiscoverContent
        currentUser={currentProfile as Profile}
        suggestedProfiles={(suggestedProfiles as Profile[]) || []}
      />
    </AppShell>
  )
}
