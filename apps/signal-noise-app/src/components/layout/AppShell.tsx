'use client'

import Link from 'next/link'
import { LogIn } from 'lucide-react'

import AppNavigation from '@/components/layout/AppNavigation'
import BackgroundAnimation from '@/components/layout/BackgroundAnimation'
import { Button } from '@/components/ui/button'

function AuthMenu() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/sign-in">
        <LogIn className="mr-2 h-4 w-4" />
        Sign In
      </Link>
    </Button>
  )
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const appContent = (
    <>
      <BackgroundAnimation />
      <AppNavigation authMenu={<AuthMenu />}>{children}</AppNavigation>
    </>
  )

  return appContent
}
