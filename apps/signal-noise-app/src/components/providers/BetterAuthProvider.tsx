"use client"

import { authClient } from "@/lib/auth-client"
import type { ReactNode } from "react"

interface BetterAuthProviderProps {
  children: ReactNode
}

export function BetterAuthProvider({ children }: BetterAuthProviderProps) {
  // Better Auth client uses cookies for session management
  // The provider mainly ensures the authClient is available
  // In production, you might want to fetch session on server-side
  return <>{children}</>
}
