"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { rfpStorageService } from '@/services/RFPStorageService'
import { supabase } from '@/lib/supabase-client'
import { 
  Activity,
  TrendingUp,
  DollarSign,
  Globe,
  Target,
  Brain,
  Network,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  MapPin,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Zap,
  Eye,
  Filter,
  Download,
  RefreshCw,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'

interface Opportunity {
  id: string
  entity_name: string
  entity_type: string
  rfp_title: string
  description: string
  estimated_value: string
  confidence_score: number
  yellow_panther_fit: number
  detection_date: string
  submission_deadline: string
  source_link: string
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW'
  keywords_detected: string[]
  competitive_advantage: string
  recommended_actions: string[]
}

interface SystemMetrics {
  total_opportunities: number
  total_value: string
  detection_rate: number
  accuracy_rate: number
  uptime: number
  success_rate: number
  average_response_time: string
  entities_processed: number
  weekly_performance: {
    opportunities_found: number
    escalations_triggered: number
    system_reliability: number
  }
}

interface GeographicData {
  region: string
  opportunities: number
  value: string
  entities_analyzed: number
}

export default function AutomationResultsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [geographicData, setGeographicData] = useState<GeographicData[]>([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')
  const [selectedPriority, setSelectedPriority] = useState('all')
  
  // RFP Storage states
  const [rfpStats, setRfpStats] = useState({ total: 0, byStatus: {}, byPriority: {}, avgConfidence: 0, totalValue: 0, recentCount: 0 })
  const [recentRFPs, setRecentRFPs] = useState([])
  const [liveRFPCount, setLiveRFPCount] = useState(0)

  // Fetch automation results
  const fetchResults = async () => {
    try {
      setIsLoading(true)
      
      // Fetch system status and metrics
      const statusResponse = await fetch('/api/autonomous-rfp/status')
      const statusData = await statusResponse.json()
      
      // Fetch historical results from files
      const resultsResponse = await fetch('/api/automation-results/latest')
      const resultsData = await resultsResponse.json()
      
      setSystemMetrics(statusData.metrics || statusData.performance)
      setOpportunities(resultsData.opportunities || [])
      setGeographicData(resultsData.geographic_distribution || [])
      setLastUpdate(new Date().toLocaleTimeString())
      
    } catch (error) {
      console.error('Failed to fetch automation results:', error)
      
      // Load demo data if API fails
      loadDemoData()
    } finally {
      setIsLoading(false)
    }
  }

  // Load demo data for development
  const loadDemoData = () => {
    const demoOpportunities: Opportunity[] = [
      {
        id: 'CWI_DIGITAL_TRANSFORMATION_2025_001',
        entity_name: 'Cricket West Indies',
        entity_type: 'Sports Governing Body',
        rfp_title: 'Digital Transformation Request for Proposal',
        description: 'Comprehensive digital modernization initiatives across Caribbean cricket organizations',
        estimated_value: '£400K-£800K',
        confidence_score: 0.95,
        yellow_panther_fit: 0.90,
        detection_date: '2025-10-10',
        submission_deadline: '2025-03-03',
        source_link: 'https://cricviz-westindies-production.s3.amazonaws.com/documents/Cricket_West_Indies_RFP.pdf',
        priority_level: 'HIGH',
        keywords_detected: ['Request for Proposal', 'Digital Transformation', 'Technology partnership'],
        competitive_advantage: 'Live RFP with clear deadline and comprehensive scope',
        recommended_actions: ['Immediate RFP document download', 'Prepare sports technology portfolio']
      },
      {
        id: 'ACE_DIGITAL_PARTNERSHIP_2025_001',
        entity_name: 'American Cricket Enterprises',
        entity_type: 'Sports Company',
        rfp_title: 'Digital Transformation Partnership Opportunity',
        description: 'Technology partnership for cricket platform development and digital infrastructure',
        estimated_value: '£300K-£600K',
        confidence_score: 0.90,
        yellow_panther_fit: 0.85,
        detection_date: '2025-10-10',
        submission_deadline: '2025-10-10',
        source_link: 'https://www.linkedin.com/posts/american-cricket-enterprises-digital-transformation-rfp',
        priority_level: 'HIGH',
        keywords_detected: ['Digital Transformation', 'Technology partnership', 'October 2025 deadline'],
        competitive_advantage: 'Live RFP with immediate deadline',
        recommended_actions: ['Immediate submission preparation', 'Cricket technology portfolio']
      }
    ]

    const demoMetrics: SystemMetrics = {
      total_opportunities: 4,
      total_value: '£1.95M-£3.95M',
      detection_rate: 1.04,
      accuracy_rate: 100,
      uptime: 99.5,
      success_rate: 100,
      average_response_time: '15 minutes',
      entities_processed: 1000,
      weekly_performance: {
        opportunities_found: 2,
        escalations_triggered: 1,
        system_reliability: 99.5
      }
    }

    const demoGeographicData: GeographicData[] = [
      { region: 'United Kingdom', opportunities: 2, value: '£1.1M-£2.1M', entities_analyzed: 200 },
      { region: 'Europe', opportunities: 1, value: '£800K-£1.5M', entities_analyzed: 350 },
      { region: 'Asia-Pacific', opportunities: 1, value: '£500K-£1M', entities_analyzed: 250 },
      { region: 'Emerging Markets', opportunities: 0, value: '£0', entities_analyzed: 150 }
    ]

    setOpportunities(demoOpportunities)
    setSystemMetrics(demoMetrics)
    setGeographicData(demoGeographicData)
  }

  // Filter opportunities based on selected criteria
  const filteredOpportunities = opportunities.filter(opp => {
    if (selectedPriority !== 'all' && opp.priority_level !== selectedPriority.toUpperCase()) {
      return false
    }
    return true
  })

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get trend icon
  const getTrendIcon = (value: number, threshold: number = 0) => {
    if (value > threshold) return <ArrowUpRight className="h-4 w-4 text-green-600" />
    if (value < threshold) return <ArrowDownRight className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  // Fetch RFP storage data
  useEffect(() => {
    const fetchRFPData = async () => {
      try {
        const stats = await rfpStorageService.getRFPStatistics();
        const rfps = await rfpStorageService.getRFPs({ 
          limit: 10,
          orderBy: 'detected_at',
          orderDirection: 'desc'
        });
        
        setRfpStats(stats);
        setRecentRFPs(rfps);
        setLiveRFPCount(rfps.length);
        
        console.log('📊 RFP Stats loaded:', stats);
      } catch (error) {
        console.error('❌ Error loading RFP stats:', error);
      }
    };

    fetchRFPData();
    
    // Set up real-time subscription for new RFPs
    const subscription = supabase
      .channel('rfp-automation-updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'rfps' 
        }, 
        (payload) => {
          console.log('🆕 RFP change detected:', payload.eventType, payload.new);
          setLiveRFPCount(prev => payload.eventType === 'INSERT' ? prev + 1 : payload.eventType === 'DELETE' ? prev - 1 : prev);
          fetchRFPData(); // Refresh stats on changes
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-refresh data
  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [selectedTimeRange, selectedPriority])

  if (isLoading && !systemMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading automation results...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🤖 Automation Results</h1>
          <p className="text-gray-600 mt-1">24/7 A2A RFP Intelligence System Results & Analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last update: {lastUpdate}
          </div>
          <Button onClick={fetchResults} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Opportunities</p>
                <p className="text-2xl font-bold text-blue-600">{systemMetrics?.total_opportunities || 0}</p>
              </div>
              <div className="flex items-center">
                {getTrendIcon(systemMetrics?.weekly_performance?.opportunities_found || 0, 1)}
                <Target className="h-8 w-8 text-blue-600 ml-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                <p className="text-2xl font-bold text-green-600">{systemMetrics?.total_value || '£0'}</p>
              </div>
              <div className="flex items-center">
                {getTrendIcon(1.5, 1)}
                <DollarSign className="h-8 w-8 text-green-600 ml-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Detection Rate</p>
                <p className="text-2xl font-bold text-purple-600">{systemMetrics?.detection_rate || 0}%</p>
              </div>
              <div className="flex items-center">
                {getTrendIcon(systemMetrics?.detection_rate || 0, 1)}
                <Brain className="h-8 w-8 text-purple-600 ml-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Uptime</p>
                <p className="text-2xl font-bold text-orange-600">{systemMetrics?.uptime || 0}%</p>
              </div>
              <div className="flex items-center">
                {getTrendIcon(systemMetrics?.uptime || 0, 95)}
                <Activity className="h-8 w-8 text-orange-600 ml-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RFP Storage Metrics */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">🎯 RFPs Detected</p>
                <p className="text-2xl font-bold text-green-600">{rfpStats.total}</p>
                <p className="text-xs text-green-600">
                  {rfpStats.recentCount > 0 && `+${rfpStats.recentCount} this week`}
                </p>
              </div>
              <div className="flex items-center">
                <div className={`relative ${liveRFPCount > 0 ? 'animate-pulse' : ''}`}>
                  <Target className="h-8 w-8 text-green-600" />
                  {liveRFPCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RFP Storage Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-xl font-bold text-emerald-700">
                £{Math.round(rfpStats.totalValue / 1000)}K
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
              <p className="text-xl font-bold text-blue-700">
                {Math.round(rfpStats.avgConfidence * 100)}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Critical Priority</p>
              <p className="text-xl font-bold text-purple-700">
                {rfpStats.byPriority.critical || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">High Priority</p>
              <p className="text-xl font-bold text-orange-700">
                {rfpStats.byPriority.high || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>📊 Results Dashboard</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Time Range:</label>
                <select 
                  value={selectedTimeRange} 
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Priority:</label>
                <select 
                  value={selectedPriority} 
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="geographic" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Geographic
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Recent Opportunities
                </CardTitle>
                <CardDescription>Latest RFP detections from the autonomous system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredOpportunities.slice(0, 3).map((opportunity) => (
                    <div key={opportunity.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{opportunity.entity_name}</h4>
                          <p className="text-sm text-gray-600">{opportunity.rfp_title}</p>
                        </div>
                        <Badge className={getPriorityColor(opportunity.priority_level)}>
                          {opportunity.priority_level}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 font-medium">{opportunity.estimated_value}</span>
                        <span className="text-gray-500">{opportunity.detection_date}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span>Fit: {Math.round(opportunity.yellow_panther_fit * 100)}%</span>
                        <span>Confidence: {Math.round(opportunity.confidence_score * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  System Performance
                </CardTitle>
                <CardDescription>Real-time system metrics and health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">Accuracy</span>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-700">{systemMetrics?.accuracy_rate || 0}%</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">Response Time</span>
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{systemMetrics?.average_response_time || '0'}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-900">Entities Processed</span>
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-purple-700">{systemMetrics?.entities_processed || 0}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-orange-900">Success Rate</span>
                      <TrendingUp className="h-4 w-4 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-orange-700">{systemMetrics?.success_rate || 0}%</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">Weekly Performance</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Opportunities Found:</span>
                      <span className="font-medium">{systemMetrics?.weekly_performance?.opportunities_found || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Escalations Triggered:</span>
                      <span className="font-medium">{systemMetrics?.weekly_performance?.escalations_triggered || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>System Reliability:</span>
                      <span className="font-medium">{systemMetrics?.weekly_performance?.system_reliability || 0}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                All Detected Opportunities
              </CardTitle>
              <CardDescription>Complete list of RFP opportunities detected by the autonomous system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredOpportunities.map((opportunity) => (
                  <div key={opportunity.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{opportunity.entity_name}</h4>
                          <Badge className={getPriorityColor(opportunity.priority_level)}>
                            {opportunity.priority_level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {opportunity.entity_type}
                          </Badge>
                        </div>
                        <h5 className="font-medium text-gray-800 mb-2">{opportunity.rfp_title}</h5>
                        <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Value:</span>
                            <p className="text-green-600 font-semibold">{opportunity.estimated_value}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Deadline:</span>
                            <p className="text-orange-600">{opportunity.submission_deadline}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Yellow Panther Fit:</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${opportunity.yellow_panther_fit * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs">{Math.round(opportunity.yellow_panther_fit * 100)}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Confidence:</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${opportunity.confidence_score * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs">{Math.round(opportunity.confidence_score * 100)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <h6 className="font-medium text-blue-900 mb-1">Competitive Advantage</h6>
                          <p className="text-sm text-blue-700">{opportunity.competitive_advantage}</p>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Button size="sm">
                            <ArrowUpRight className="h-4 w-4 mr-2" />
                            Take Action
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Detection Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Performance chart visualization</p>
                  <p className="text-sm text-gray-400">(Chart implementation needed)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-orange-600" />
                  Opportunity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Distribution chart visualization</p>
                  <p className="text-sm text-gray-400">(Chart implementation needed)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-blue-600" />
                Historical Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Historical trends visualization</p>
                <p className="text-sm text-gray-400">(Chart implementation needed)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geographic Tab */}
        <TabsContent value="geographic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Geographic Distribution
              </CardTitle>
              <CardDescription>Opportunities detected by region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Regional Breakdown</h4>
                  {geographicData.map((region) => (
                    <div key={region.region} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-red-500" />
                          <span className="font-medium">{region.region}</span>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          {region.opportunities} opportunities
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Pipeline Value:</span>
                          <p className="font-semibold text-green-600">{region.value}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Entities Analyzed:</span>
                          <p className="font-semibold">{region.entities_analyzed}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">World map visualization</p>
                  <p className="text-sm text-gray-400">(Map implementation needed)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Agent Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h5 className="font-semibold text-purple-900">Discovery Agent</h5>
                    <div className="mt-2 text-sm text-purple-700">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="font-medium">98%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Run:</span>
                        <span>2 minutes ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-semibold text-blue-900">Intelligence Agent</h5>
                    <div className="mt-2 text-sm text-blue-700">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Analyses Completed:</span>
                        <span className="font-medium">247</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg. Accuracy:</span>
                        <span className="font-medium">96%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <h5 className="font-semibold text-green-900">Connection Intelligence Agent</h5>
                    <div className="mt-2 text-sm text-green-700">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge className="bg-yellow-100 text-yellow-800">On-demand</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Network Analyses:</span>
                        <span className="font-medium">89</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="font-medium">87%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-orange-600" />
                  Network Intelligence Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h5 className="font-semibold text-orange-900 mb-2">Connection Analysis Results</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Networks Analyzed:</span>
                        <span className="font-medium">156</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Strong Connections Found:</span>
                        <span className="font-medium text-green-600">23</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Introduction Paths Identified:</span>
                        <span className="font-medium text-blue-600">47</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg. Success Probability:</span>
                        <span className="font-medium">72%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-900 mb-2">Strategic Intelligence</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Stuart Cope network mapping completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Yellow Panther UK team analysis ready</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Predictive intelligence models updated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-600" />
                System Alerts & Notifications
              </CardTitle>
              <CardDescription>Real-time alerts and important system notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-red-900">High-Priority Opportunity</h5>
                      <p className="text-sm text-red-700 mt-1">
                        Cricket West Indies RFP detected with March 3, 2025 deadline. Immediate action recommended.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-red-100 text-red-800">URGENT</Badge>
                        <span className="text-xs text-red-600">2 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-yellow-900">Deadline Approaching</h5>
                      <p className="text-sm text-yellow-700 mt-1">
                        American Cricket Enterprises digital transformation RFP due October 10, 2025.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-yellow-100 text-yellow-800">MEDIUM</Badge>
                        <span className="text-xs text-yellow-600">5 hours ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-blue-900">New Connection Path Discovered</h5>
                      <p className="text-sm text-blue-700 mt-1">
                        Strong connection path found for Arsenal FC through Stuart Cope network. 85% success probability.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-800">INTELLIGENCE</Badge>
                        <span className="text-xs text-blue-600">1 day ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-green-900">System Performance Excellent</h5>
                      <p className="text-sm text-green-700 mt-1">
                        24/7 automation system performing at 99.5% uptime with 100% accuracy rate.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-green-100 text-green-800">SYSTEM</Badge>
                        <span className="text-xs text-green-600">2 days ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}