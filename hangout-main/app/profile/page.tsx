import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ProfileContent } from "@/components/profile-content"
import type { Profile } from "@/lib/types"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!currentProfile) redirect("/profile/setup")

  return (
    <AppShell currentUser={currentProfile as Profile}>
      <ProfileContent profile={currentProfile as Profile} />
    </AppShell>
  )
}
