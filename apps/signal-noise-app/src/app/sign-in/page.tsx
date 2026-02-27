import { SignInForm } from "@/components/auth/SignInForm"
import Link from "next/link"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold tracking-tight">Signal Noise</h1>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Sports Intelligence & RFP Analysis Platform
          </p>
        </div>
        <SignInForm />
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
