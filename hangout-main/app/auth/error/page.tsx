import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, Users } from "lucide-react"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>

        <Card className="border-border text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-card-foreground">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {params?.error ? (
              <p className="text-muted-foreground">Error: {params.error}</p>
            ) : (
              <p className="text-muted-foreground">An unspecified error occurred during authentication.</p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/auth/login">
                <Button className="w-full bg-primary text-primary-foreground">Try signing in again</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full border-border text-foreground bg-transparent">
                  Go home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
