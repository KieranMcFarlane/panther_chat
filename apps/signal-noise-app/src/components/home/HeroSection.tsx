'use client'

import { Search, TrendingUp, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeroSection() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/tenders?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="text-center mb-12">
      {/* Main Title */}
      <h1 className="font-header-large text-fm-white text-center mb-4 drop-shadow-lg">
        FIND YOUR NEXT SPORTS TECH OPPORTUNITY
      </h1>
      
      {/* Subtitle */}
      <p className="font-body-primary-large text-fm-light-grey text-center mb-6 drop-shadow-md max-w-3xl mx-auto">
        AI-powered RFP detection • 4,422+ sports entities • Real-time alerts
      </p>

      {/* Primary CTAs */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <Link href="/tenders">
          <Button 
            size="lg" 
            className="bg-yellow-500 text-black hover:bg-yellow-400 font-semibold px-8 py-6 text-lg"
          >
            Find Opportunities
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
        <Link href="/entity-browser">
          <Button 
            size="lg" 
            variant="outline"
            className="border-2 border-white/20 text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg"
          >
            Explore Entities
          </Button>
        </Link>
      </div>

      {/* Quick Search */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fm-medium-grey" />
          <Input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-4 py-6 text-lg bg-custom-box/80 backdrop-blur-md border border-custom-border text-white placeholder:text-fm-medium-grey focus:border-yellow-400"
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-yellow-500 text-black hover:bg-yellow-400"
            size="sm"
          >
            Search
          </Button>
        </div>
      </form>

      {/* Trust Indicators */}
      <div className="flex flex-wrap justify-center gap-4">
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
          40+ Active RFPs
        </Badge>
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-4 py-2">
          £21M+ Pipeline
        </Badge>
        <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-2">
          Updated Today
        </Badge>
      </div>
    </div>
  )
}

