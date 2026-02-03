import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Users } from "lucide-react"

export default function SignUpSuccessPage() {
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
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl text-card-foreground">Check your email</CardTitle>
            <CardDescription className="text-base">We sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Click the link in your email to verify your account and start connecting with friends on Hangout.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
