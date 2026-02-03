import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { FriendsContent } from "@/components/friends-content"
import type { Profile, Friendship } from "@/lib/types"

export default async function FriendsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) redirect("/profile/setup")

  // Get all friendships with profiles
  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      `
      *,
      requester:profiles!friendships_requester_id_fkey(*),
      addressee:profiles!friendships_addressee_id_fkey(*)
    `,
    )
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  return (
    <AppShell currentUser={currentProfile as Profile}>
      <FriendsContent currentUserId={user.id} friendships={(friendships as Friendship[]) || []} />
    </AppShell>
  )
}
