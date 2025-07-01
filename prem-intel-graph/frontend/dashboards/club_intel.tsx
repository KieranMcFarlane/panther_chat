'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Users, Target, Calendar, MapPin, Building2, AlertCircle } from 'lucide-react'

interface Club {
  name: string
  tier: string
  location: string
  digitalMaturity: string
  website: string
  stadium: string
  partnershipStatus: 'partnered' | 'unpartnered'
  agency?: string
}

interface Signal {
  id: string
  headline: string
  summary: string
  date: string
  score: number
  intelType: string
  source: string
}

interface Stakeholder {
  name: string
  title: string
  linkedinUrl: string
  influenceScore: number
  club: string
}

interface ClubIntelData {
  club: Club
  recentSignals: Signal[]
  keyStakeholders: Stakeholder[]
  opportunityScore: number
  trendAnalysis: {
    signalCount30d: number
    avgScore30d: number
    topSignalTypes: string[]
  }
}

export default function ClubIntelligenceDashboard() {
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [clubData, setClubData] = useState<ClubIntelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTier, setFilterTier] = useState('all')

  // Mock data - replace with actual Neo4j API calls
  const mockClubs: Club[] = [
    { name: 'Arsenal', tier: 'Big 6', location: 'London', digitalMaturity: 'High', website: 'https://www.arsenal.com', stadium: 'Emirates Stadium', partnershipStatus: 'partnered', agency: 'Two Circles' },
    { name: 'Chelsea FC', tier: 'Big 6', location: 'London', digitalMaturity: 'High', website: 'https://www.chelseafc.com', stadium: 'Stamford Bridge', partnershipStatus: 'partnered', agency: 'Lagardère Sports' },
    { name: 'Brighton & Hove Albion', tier: 'Mid-Table', location: 'Brighton', digitalMaturity: 'High', website: 'https://www.brightonandhovealbion.com', stadium: 'Amex Stadium', partnershipStatus: 'unpartnered' },
    { name: 'Newcastle United', tier: 'Mid-Table', location: 'Newcastle', digitalMaturity: 'Medium', website: 'https://www.nufc.co.uk', stadium: 'St. James\' Park', partnershipStatus: 'unpartnered' }
  ]

  const fetchClubData = async (clubName: string) => {
    setLoading(true)
    // Simulate API call - replace with actual Neo4j query
    setTimeout(() => {
      const mockData: ClubIntelData = {
        club: mockClubs.find(c => c.name === clubName)!,
        recentSignals: [
          {
            id: '1',
            headline: `${clubName} announces new digital fan platform`,
            summary: 'Club partners with tech startup for enhanced matchday experience',
            date: '2024-01-20',
            score: 8.7,
            intelType: 'Tech Investment',
            source: 'club-website'
          },
          {
            id: '2',
            headline: `${clubName} hiring Head of Digital Innovation`,
            summary: 'New role focuses on fan engagement and digital transformation',
            date: '2024-01-18',
            score: 9.1,
            intelType: 'Hiring',
            source: 'linkedin'
          }
        ],
        keyStakeholders: [
          {
            name: 'Sarah Johnson',
            title: 'Chief Marketing Officer',
            linkedinUrl: 'https://linkedin.com/in/sarahjohnson',
            influenceScore: 85,
            club: clubName
          },
          {
            name: 'Mike Thompson',
            title: 'Head of Digital',
            linkedinUrl: 'https://linkedin.com/in/mikethompson',
            influenceScore: 78,
            club: clubName
          }
        ],
        opportunityScore: 8.4,
        trendAnalysis: {
          signalCount30d: 5,
          avgScore30d: 7.8,
          topSignalTypes: ['Tech Investment', 'Hiring', 'Fan Innovation']
        }
      }
      setClubData(mockData)
      setLoading(false)
    }, 1000)
  }

  const filteredClubs = mockClubs.filter(club => {
    const matchesSearch = club.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = filterTier === 'all' || club.tier === filterTier
    return matchesSearch && matchesTier
  })

  const getOpportunityColor = (score: number) => {
    if (score >= 8.0) return 'text-red-500'
    if (score >= 7.0) return 'text-orange-500'
    if (score >= 6.0) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getMaturityBadge = (maturity: string) => {
    const variants = {
      'Very High': 'bg-green-100 text-green-800',
      'High': 'bg-blue-100 text-blue-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-gray-100 text-gray-800'
    }
    return variants[maturity] || variants['Low']
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Club Intelligence Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive intelligence on Premier League clubs and opportunities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-green-50">
            {mockClubs.filter(c => c.partnershipStatus === 'unpartnered').length} Unpartnered Clubs
          </Badge>
          <Badge variant="outline" className="bg-blue-50">
            Live Data
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Club Selection Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Premier League Clubs
            </CardTitle>
            <CardDescription>
              Select a club to view detailed intelligence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search clubs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Big 6">Big 6</SelectItem>
                <SelectItem value="Mid-Table">Mid-Table</SelectItem>
                <SelectItem value="Lower-Table">Lower-Table</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="space-y-2">
              {filteredClubs.map((club) => (
                <div
                  key={club.name}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedClub === club.name 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedClub(club.name)
                    fetchClubData(club.name)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{club.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {club.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={getMaturityBadge(club.digitalMaturity)}>
                        {club.digitalMaturity}
                      </Badge>
                      {club.partnershipStatus === 'unpartnered' && (
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Club Details Panel */}
        <div className="lg:col-span-2">
          {!selectedClub ? (
            <Card className="h-96 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a club to view detailed intelligence</p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card className="h-96 flex items-center justify-center">
              <CardContent>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading club intelligence...</p>
                </div>
              </CardContent>
            </Card>
          ) : clubData ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="signals">Signals</TabsTrigger>
                <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
                <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{clubData.club.name}</CardTitle>
                      <CardDescription>{clubData.club.stadium}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Tier:</span>
                          <Badge variant="outline">{clubData.club.tier}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Digital Maturity:</span>
                          <Badge className={getMaturityBadge(clubData.club.digitalMaturity)}>
                            {clubData.club.digitalMaturity}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Partnership:</span>
                          <Badge variant={clubData.club.partnershipStatus === 'partnered' ? 'default' : 'destructive'}>
                            {clubData.club.partnershipStatus === 'partnered' ? clubData.club.agency : 'Unpartnered'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        30-Day Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Signals:</span>
                          <span className="font-medium">{clubData.trendAnalysis.signalCount30d}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Avg Score:</span>
                          <span className="font-medium">{clubData.trendAnalysis.avgScore30d.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Top Types:</span>
                          <div className="flex gap-1">
                            {clubData.trendAnalysis.topSignalTypes.slice(0, 2).map(type => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="signals">
                <div className="space-y-4">
                  {clubData.recentSignals.map((signal) => (
                    <Card key={signal.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{signal.headline}</CardTitle>
                            <CardDescription>{signal.summary}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getOpportunityColor(signal.score)}`}>
                              {signal.score.toFixed(1)}
                            </div>
                            <Badge variant="outline">{signal.intelType}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(signal.date).toLocaleDateString()}
                          </span>
                          <span>Source: {signal.source}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="stakeholders">
                <div className="space-y-4">
                  {clubData.keyStakeholders.map((stakeholder, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{stakeholder.name}</h3>
                            <p className="text-sm text-muted-foreground">{stakeholder.title}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-blue-600">
                              {stakeholder.influenceScore}
                            </div>
                            <p className="text-xs text-muted-foreground">Influence Score</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" size="sm" asChild>
                            <a href={stakeholder.linkedinUrl} target="_blank" rel="noopener noreferrer">
                              View LinkedIn
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="opportunity">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Partnership Opportunity Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getOpportunityColor(clubData.opportunityScore)}`}>
                          {clubData.opportunityScore.toFixed(1)}/10
                        </div>
                        <p className="text-muted-foreground">Opportunity Score</p>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-semibold">Recommended Actions:</h4>
                        <div className="space-y-2">
                          {clubData.club.partnershipStatus === 'unpartnered' && (
                            <div className="p-3 rounded-lg bg-green-900/40 border border-green-700/50">
                              <p className="text-sm font-medium text-green-200">High Priority Target</p>
                              <p className="text-sm text-slate-300">Club is unpartnered with strong digital focus</p>
                            </div>
                          )}
                          {clubData.club.partnershipStatus === 'partnered' && (
                            <div className="p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
                              <p className="text-sm font-medium text-slate-200">Monitor</p>
                              <p className="text-sm text-slate-300">Currently partnered with {clubData.club.agency}. Monitor for contract changes.</p>
                            </div>
                          )}
                          <div className="p-3 rounded-lg bg-blue-900/40 border border-blue-700/50">
                            <p className="text-sm font-medium text-blue-200">Research Key Stakeholders</p>
                            <p className="text-sm text-slate-300">Focus on CMO and Head of Digital roles</p>
                          </div>
                          <div className="p-3 rounded-lg bg-purple-900/40 border border-purple-700/50">
                            <p className="text-sm font-medium text-purple-200">Monitor Signal Activity</p>
                            <p className="text-sm text-slate-300">Track hiring and investment signals</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
    </div>
  )
} 