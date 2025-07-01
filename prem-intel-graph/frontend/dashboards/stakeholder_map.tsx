'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Network, Search, Filter, Eye, ExternalLink, MessageSquare } from 'lucide-react'

interface StakeholderNode {
  id: string
  name: string
  title: string
  club: string
  influenceScore: number
  linkedinUrl: string
  email?: string
  department: string
  yearsInRole: number
  previousRoles: Array<{
    title: string
    company: string
    duration: string
  }>
}

interface RelationshipEdge {
  source: string
  target: string
  relationship: 'reports_to' | 'collaborates' | 'former_colleague' | 'external_contact'
  strength: number
  description: string
}

interface NetworkData {
  nodes: StakeholderNode[]
  edges: RelationshipEdge[]
}

interface ConnectionPath {
  path: StakeholderNode[]
  edges: RelationshipEdge[]
  totalStrength: number
  description: string
}

export default function StakeholderMap() {
  const [selectedStakeholder, setSelectedStakeholder] = useState<StakeholderNode | null>(null)
  const [networkData, setNetworkData] = useState<NetworkData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClub, setFilterClub] = useState('all')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [connectionPaths, setConnectionPaths] = useState<ConnectionPath[]>([])
  const [targetStakeholder, setTargetStakeholder] = useState('')
  const networkRef = useRef<HTMLDivElement>(null)

  // Mock data - replace with actual Neo4j API calls
  const mockNetworkData: NetworkData = {
    nodes: [
      {
        id: 'sarah_johnson',
        name: 'Sarah Johnson',
        title: 'Chief Marketing Officer',
        club: 'Manchester City',
        influenceScore: 92,
        linkedinUrl: 'https://linkedin.com/in/sarahjohnson',
        email: 'sarah.johnson@mancity.com',
        department: 'Marketing',
        yearsInRole: 2.5,
        previousRoles: [
          { title: 'Head of Digital', company: 'Liverpool FC', duration: '2019-2021' },
          { title: 'Digital Manager', company: 'Arsenal', duration: '2017-2019' }
        ]
      },
      {
        id: 'tom_glick',
        name: 'Tom Glick',
        title: 'Chief Operating Officer',
        club: 'Chelsea FC',
        influenceScore: 88,
        linkedinUrl: 'https://linkedin.com/in/tomglick',
        department: 'Operations',
        yearsInRole: 1.8,
        previousRoles: [
          { title: 'COO', company: 'Carolina Panthers', duration: '2018-2022' }
        ]
      },
      {
        id: 'peter_moore',
        name: 'Peter Moore',
        title: 'Chief Executive Officer',
        club: 'Liverpool FC',
        influenceScore: 95,
        linkedinUrl: 'https://linkedin.com/in/petermoore',
        department: 'Executive',
        yearsInRole: 4.2,
        previousRoles: [
          { title: 'CEO', company: 'Electronic Arts', duration: '2007-2017' }
        ]
      },
      {
        id: 'juliet_slot',
        name: 'Juliet Slot',
        title: 'Chief Marketing Officer',
        club: 'Arsenal',
        influenceScore: 85,
        linkedinUrl: 'https://linkedin.com/in/julietslot',
        department: 'Marketing',
        yearsInRole: 3.1,
        previousRoles: [
          { title: 'Marketing Director', company: 'Nike', duration: '2015-2020' }
        ]
      },
      {
        id: 'mike_thompson',
        name: 'Mike Thompson',
        title: 'Head of Digital Innovation',
        club: 'Brighton & Hove Albion',
        influenceScore: 73,
        linkedinUrl: 'https://linkedin.com/in/mikethompson',
        department: 'Technology',
        yearsInRole: 1.2,
        previousRoles: [
          { title: 'Digital Product Manager', company: 'Sky Sports', duration: '2020-2022' }
        ]
      }
    ],
    edges: [
      {
        source: 'sarah_johnson',
        target: 'juliet_slot',
        relationship: 'former_colleague',
        strength: 0.8,
        description: 'Worked together at Arsenal 2017-2019'
      },
      {
        source: 'peter_moore',
        target: 'sarah_johnson',
        relationship: 'former_colleague',
        strength: 0.7,
        description: 'Overlapped at Liverpool FC during Sarah\'s time there'
      },
      {
        source: 'mike_thompson',
        target: 'sarah_johnson',
        relationship: 'external_contact',
        strength: 0.6,
        description: 'Connected through digital innovation community'
      },
      {
        source: 'tom_glick',
        target: 'peter_moore',
        relationship: 'external_contact',
        strength: 0.5,
        description: 'Sports executive network'
      }
    ]
  }

  useEffect(() => {
    // Simulate API call to fetch network data
    setNetworkData(mockNetworkData)
  }, [])

  const filteredStakeholders = networkData?.nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClub = filterClub === 'all' || node.club === filterClub
    const matchesDepartment = filterDepartment === 'all' || node.department === filterDepartment
    return matchesSearch && matchesClub && matchesDepartment
  }) || []

  const findConnectionPaths = (targetId: string) => {
    if (!networkData || !selectedStakeholder) return []

    // Simple 2-hop path finding - replace with more sophisticated algorithm
    const paths: ConnectionPath[] = []
    const edges = networkData.edges

    // Direct connection
    const directEdge = edges.find(e => 
      (e.source === selectedStakeholder.id && e.target === targetId) ||
      (e.target === selectedStakeholder.id && e.source === targetId)
    )

    if (directEdge) {
      const targetNode = networkData.nodes.find(n => n.id === targetId)!
      paths.push({
        path: [selectedStakeholder, targetNode],
        edges: [directEdge],
        totalStrength: directEdge.strength,
        description: `Direct connection: ${directEdge.description}`
      })
    }

    // Two-hop connections
    edges.forEach(firstEdge => {
      if (firstEdge.source === selectedStakeholder.id || firstEdge.target === selectedStakeholder.id) {
        const intermediateId = firstEdge.source === selectedStakeholder.id ? firstEdge.target : firstEdge.source
        
        edges.forEach(secondEdge => {
          if ((secondEdge.source === intermediateId && secondEdge.target === targetId) ||
              (secondEdge.target === intermediateId && secondEdge.source === targetId)) {
            const intermediateNode = networkData.nodes.find(n => n.id === intermediateId)!
            const targetNode = networkData.nodes.find(n => n.id === targetId)!
            
            paths.push({
              path: [selectedStakeholder, intermediateNode, targetNode],
              edges: [firstEdge, secondEdge],
              totalStrength: (firstEdge.strength + secondEdge.strength) / 2,
              description: `Via ${intermediateNode.name} at ${intermediateNode.club}`
            })
          }
        })
      }
    })

    return paths.sort((a, b) => b.totalStrength - a.totalStrength).slice(0, 3)
  }

  const getInfluenceColor = (score: number) => {
    if (score >= 90) return 'text-red-500 bg-red-50'
    if (score >= 80) return 'text-orange-500 bg-orange-50'
    if (score >= 70) return 'text-yellow-500 bg-yellow-50'
    return 'text-green-500 bg-green-50'
  }

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship) {
      case 'reports_to': return '👥'
      case 'collaborates': return '🤝'
      case 'former_colleague': return '🏢'
      case 'external_contact': return '🌐'
      default: return '👤'
    }
  }

  const uniqueClubs = [...new Set(networkData?.nodes.map(n => n.club) || [])]
  const uniqueDepartments = [...new Set(networkData?.nodes.map(n => n.department) || [])]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stakeholder Relationship Map</h1>
          <p className="text-muted-foreground">
            Navigate the Premier League decision-maker network and find warm introduction paths
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-blue-50">
            {networkData?.nodes.length || 0} Stakeholders
          </Badge>
          <Badge variant="outline" className="bg-green-50">
            {networkData?.edges.length || 0} Connections
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search and Filter Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search stakeholders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <Select value={filterClub} onValueChange={setFilterClub}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by club" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clubs</SelectItem>
                {uniqueClubs.map(club => (
                  <SelectItem key={club} value={club}>{club}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {uniqueDepartments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Stakeholder List</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStakeholders.map((stakeholder) => (
                  <div
                    key={stakeholder.id}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedStakeholder?.id === stakeholder.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedStakeholder(stakeholder)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{stakeholder.name}</p>
                        <p className="text-xs text-muted-foreground">{stakeholder.title}</p>
                        <p className="text-xs text-muted-foreground">{stakeholder.club}</p>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${getInfluenceColor(stakeholder.influenceScore)}`}>
                        {stakeholder.influenceScore}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {!selectedStakeholder ? (
            <Card className="h-96 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a stakeholder to view their network and details</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                <TabsTrigger value="connections">Find Connections</TabsTrigger>
                <TabsTrigger value="outreach">Outreach</TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl">{selectedStakeholder.name}</CardTitle>
                        <CardDescription className="text-lg">{selectedStakeholder.title}</CardDescription>
                        <p className="text-muted-foreground mt-1">{selectedStakeholder.club}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getInfluenceColor(selectedStakeholder.influenceScore)}`}>
                          {selectedStakeholder.influenceScore}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Influence Score</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">Current Role</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Department:</span>
                            <Badge variant="outline">{selectedStakeholder.department}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Years in Role:</span>
                            <span className="text-sm font-medium">{selectedStakeholder.yearsInRole} years</span>
                          </div>
                          {selectedStakeholder.email && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Email:</span>
                              <span className="text-sm font-medium">{selectedStakeholder.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Previous Experience</h4>
                        <div className="space-y-2">
                          {selectedStakeholder.previousRoles.map((role, index) => (
                            <div key={index} className="p-2 border rounded-lg">
                              <p className="text-sm font-medium">{role.title}</p>
                              <p className="text-xs text-muted-foreground">{role.company}</p>
                              <p className="text-xs text-muted-foreground">{role.duration}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button asChild>
                        <a href={selectedStakeholder.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View LinkedIn
                        </a>
                      </Button>
                      <Button variant="outline">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Draft Outreach
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="network">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="w-5 h-5" />
                      Network Connections
                    </CardTitle>
                    <CardDescription>
                      Direct relationships and professional connections for {selectedStakeholder.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {networkData?.edges
                        .filter(edge => edge.source === selectedStakeholder.id || edge.target === selectedStakeholder.id)
                        .map((edge, index) => {
                          const connectedNodeId = edge.source === selectedStakeholder.id ? edge.target : edge.source
                          const connectedNode = networkData.nodes.find(n => n.id === connectedNodeId)!
                          
                          return (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="text-2xl">
                                  {getRelationshipIcon(edge.relationship)}
                                </div>
                                <div>
                                  <p className="font-medium">{connectedNode.name}</p>
                                  <p className="text-sm text-muted-foreground">{connectedNode.title}</p>
                                  <p className="text-sm text-muted-foreground">{connectedNode.club}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-blue-600">
                                  {(edge.strength * 100).toFixed(0)}%
                                </div>
                                <p className="text-xs text-muted-foreground">Connection Strength</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2"
                                  onClick={() => setSelectedStakeholder(connectedNode)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="connections">
                <Card>
                  <CardHeader>
                    <CardTitle>Find Connection Paths</CardTitle>
                    <CardDescription>
                      Discover warm introduction paths to target stakeholders
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Select value={targetStakeholder} onValueChange={setTargetStakeholder}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select target stakeholder" />
                        </SelectTrigger>
                        <SelectContent>
                          {networkData?.nodes
                            .filter(n => n.id !== selectedStakeholder.id)
                            .map(node => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.name} - {node.club}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={() => {
                          if (targetStakeholder) {
                            const paths = findConnectionPaths(targetStakeholder)
                            setConnectionPaths(paths)
                          }
                        }}
                      >
                        Find Paths
                      </Button>
                    </div>

                    {connectionPaths.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">Connection Paths Found:</h4>
                        {connectionPaths.map((path, index) => (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">Path {index + 1}</h5>
                              <Badge variant="outline">
                                {(path.totalStrength * 100).toFixed(0)}% strength
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              {path.path.map((node, nodeIndex) => (
                                <React.Fragment key={node.id}>
                                  <span className="font-medium">{node.name}</span>
                                  {nodeIndex < path.path.length - 1 && (
                                    <span className="text-muted-foreground">→</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{path.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="outreach">
                <Card>
                  <CardHeader>
                    <CardTitle>Outreach Strategy</CardTitle>
                    <CardDescription>
                      Recommended approach for connecting with {selectedStakeholder.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold text-green-700 mb-2">✅ Strengths</h4>
                        <ul className="text-sm space-y-1">
                          <li>• High influence score ({selectedStakeholder.influenceScore})</li>
                          <li>• {selectedStakeholder.yearsInRole} years in current role</li>
                          <li>• Active in {selectedStakeholder.department} decisions</li>
                          <li>• Previous experience at {selectedStakeholder.previousRoles[0]?.company}</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold text-blue-700 mb-2">🎯 Approach</h4>
                        <ul className="text-sm space-y-1">
                          <li>• Lead with digital innovation expertise</li>
                          <li>• Reference {selectedStakeholder.club}'s recent signals</li>
                          <li>• Mention mutual connections</li>
                          <li>• Focus on fan engagement ROI</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">Recommended Outreach Timeline</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Week 1:</span>
                          <span>LinkedIn connection + thoughtful message</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Week 2:</span>
                          <span>Share relevant industry insight</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Week 3:</span>
                          <span>Request brief call to discuss opportunities</span>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full">
                      Generate Personalized Outreach Template
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
} 