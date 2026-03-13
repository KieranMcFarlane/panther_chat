"use client"

export const dynamic = 'force-dynamic'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BadgeManagementDashboard } from '@/components/badge/BadgeManagementDashboard'

export default function BadgeManagementPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🏆</span>
              </div>
              <h1 className="text-3xl font-bold">Badge Management</h1>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/entity-browser'
                }}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Browser
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <BadgeManagementDashboard />
      </div>
    </div>
  )
}
