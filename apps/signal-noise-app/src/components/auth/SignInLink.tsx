"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LogIn } from "lucide-react"

export function SignInLink() {
  const { data: session } = authClient.useSession()

  // Show sign-in link only when not authenticated
  if (session) {
    return null
  }

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/sign-in">
        <LogIn className="mr-2 h-4 w-4" />
        Sign In
      </Link>
    </Button>
  )
}
