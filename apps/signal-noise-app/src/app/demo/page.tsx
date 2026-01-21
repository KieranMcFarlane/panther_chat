"use client"

import SalesIntelligenceHome from "@/components/sales/SalesIntelligenceHome"

export default function DemoHero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br z-0 from-gray-900 via-blue-900 to-gray-900">
      {/* Content Overlay */}
      <div className="relative z-10">
        <SalesIntelligenceHome />
      </div>
    </div>
  )
}
