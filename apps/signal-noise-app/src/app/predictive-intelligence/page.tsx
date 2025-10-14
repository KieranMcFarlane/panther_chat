'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Zap,
  Eye,
  BarChart3,
  Lightbulb,
  Calendar,
  DollarSign
} from 'lucide-react'

interface PredictiveOpportunity {
  id: string
  entity: string
  entityType: string
  sport: string
  predictedRFP: string
  estimatedValue: string
  confidence: number
  timeline: string
  evidence: {
    primary: string[]
    secondary: string[]
    supporting: string[]
  }
  recommendedActions: string[]
  strategicAdvantage: string
}

interface PredictiveStatus {
  isActive: boolean
  activePatterns: number
  currentPredictions: number
  highConfidencePredictions: number
  modelAccuracy: number
  estimatedPipelineValue: string
}

export default function PredictiveIntelligencePage() {
  const [status, setStatus] = useState<PredictiveStatus | null>(null)
  const [opportunities, setOpportunities] = useState<PredictiveOpportunity[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    fetchPredictiveStatus()
    fetchPredictiveOpportunities()
    
    // Set up real-time status polling
    const interval = setInterval(fetchPredictiveStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchPredictiveStatus = async () => {
    try {
      const response = await fetch('/api/predictive-intelligence/start')
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.systemInfo)
      }
    } catch (error) {
      console.error('Failed to fetch predictive status:', error)
    }
  }

  const fetchPredictiveOpportunities = async () => {
    try {
      // Mock predictions based on your documented results
      const mockOpportunities: PredictiveOpportunity[] = [
        {
          id: 'prediction_1',
          entity: 'World Rowing Federation (FISA)',
          entityType: 'International Federation',
          sport: 'Rowing',
          predictedRFP: 'Digital Transformation Partnership 2025-2030',
          estimatedValue: '£400K-£700K',
          confidence: 87,
          timeline: '30-60 days',
          evidence: {
            primary: ['€2.5M technology budget approved', 'Strategic modernization plan announced'],
            secondary: ['"Modernizing our digital infrastructure for 2026-2030" - LinkedIn', 'CTO position created 3 months ago'],
            supporting: ['Last digital transformation: 2019 (6 years ago)', 'Peer federations undergoing similar upgrades']
          },
          recommendedActions: [
            'Begin relationship building with technology leadership',
            'Schedule technical discovery meetings',
            'Prepare rowing-specific technology case studies'
          ],
          strategicAdvantage: '60-90 day first-mover advantage with pre-existing relationships'
        },
        {
          id: 'prediction_2',
          entity: 'International Ski Federation (FIS)',
          entityType: 'International Federation',
          sport: 'Skiing',
          predictedRFP: 'Olympic Preparation Technology Platform',
          estimatedValue: '£600K-£1.1M',
          confidence: 87.4,
          timeline: '45-75 days',
          evidence: {
            primary: ['Milan-Cortina 2026 preparation funding', 'Alpine skiing technology modernization announced'],
            secondary: ['Cross-country skiing digital platform investment', 'Olympic broadcast technology requirements'],
            supporting: ['Historical 4-year Olympic cycle patterns', 'Peer federation technology investments']
          },
          recommendedActions: [
            'Develop Olympic-focused technology capabilities',
            'Prepare alpine skiing and cross-country expertise',
            'Build winter sports federation relationship network'
          ],
          strategicAdvantage: 'Specialized Olympic preparation positioning with established relationships'
        },
        {
          id: 'prediction_3',
          entity: 'Cricket Australia',
          entityType: 'National Federation',
          sport: 'Cricket',
          predictedRFP: 'Digital Platform and Fan Engagement Modernization',
          estimatedValue: '£800K-£1.4M',
          confidence: 78,
          timeline: '60-90 days',
          evidence: {
            primary: ['Post-T20 World Cup investment planning', 'Digital transformation budget allocated'],
            secondary: ['"Enhancing fan experience through technology" - recent announcement', 'New CDO appointed'],
            supporting: ['3-year post-tournament investment cycle', 'Peer federations launching similar platforms']
          },
          recommendedActions: [
            'Develop cricket-specific digital platform capabilities',
            'Build fan engagement expertise',
            'Research successful cricket technology implementations'
          ],
          strategicAdvantage: 'Tournament-driven investment wave with established timing'
        }
      ];
      
      setOpportunities(mockOpportunities)
    } catch (error) {
      console.error('Failed to fetch predictive opportunities:', error)
    }
  }

  const startPredictiveIntelligence = async () => {
    if (isStarting) return
    
    setIsStarting(true)
    
    try {
      const response = await fetch('/api/predictive-intelligence/start', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.systemInfo)
        
        // Simulate real-time log streaming
        const mockLogs = [
          { timestamp: new Date().toISOString(), type: 'system', message: '🧠 OPPORTUNITY ARCHITECT ACTIVATED' },
          { timestamp: new Date().toISOString(), type: 'pattern', message: '🔍 Pattern Recognition Engine started' },
          { timestamp: new Date().toISOString(), type: 'theory', message: '🌊 Theory Generation: Federation Digital Transformation Cycle detected' },
          { timestamp: new Date().toISOString(), type: 'evidence', message: '🔍 Evidence Validation: World Rowing Federation signals identified' },
          { timestamp: new Date().toISOString(), type: 'prediction', message: '🎯 Prediction: World Rowing Federation - 87% confidence (£400K-£700K)' },
          { timestamp: new Date().toISOString(), type: 'prediction', message: '🎯 Prediction: International Ski Federation - 87.4% confidence (£600K-£1.1M)' },
          { timestamp: new Date().toISOString(), type: 'system', message: '✅ Predictive Intelligence workflow completed' }
        ]
        
        setLogs(mockLogs)
      }
    } catch (error) {
      console.error('Failed to start predictive intelligence:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-500'
    if (confidence >= 80) return 'bg-blue-500'
    if (confidence >= 70) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 90) return 'Critical'
    if (confidence >= 80) return 'High'
    if (confidence >= 70) return 'Medium'
    return 'Low'
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-500" />
              Predictive Intelligence Agent
            </h1>
            <p className="text-gray-400 mt-2">
              60-90 Day RFP Forecasting System with 85% Prediction Accuracy
            </p>
          </div>
          <div className="flex items-center gap-3">
            {status?.isActive ? (
              <Badge className="bg-green-600 animate-pulse">
                ● ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline">
                INACTIVE
              </Badge>
            )}
            {status && (
              <Badge variant="outline">
                {status.modelAccuracy}% Accuracy
              </Badge>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Intelligence Control
              </span>
              <Button
                onClick={startPredictiveIntelligence}
                disabled={isStarting || status?.isActive}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isStarting ? 'Starting...' : status?.isActive ? 'Active' : 'Start Predictive Analysis'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Active Patterns</div>
                <div className="text-lg font-semibold">{status?.activePatterns || 0}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Predictions</div>
                <div className="text-lg font-semibold">{status?.currentPredictions || 0}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">High Confidence</div>
                <div className="text-lg font-semibold">{status?.highConfidencePredictions || 0}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Pipeline Value</div>
                <div className="text-lg font-semibold">{status?.estimatedPipelineValue || '£0M-£0M'}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Model Accuracy</div>
                <div className="text-lg font-semibold">{status?.modelAccuracy || 0}%</div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-purple-900/30 rounded-lg border border-purple-700">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Strategic Advantage</span>
              </div>
              <div className="text-sm text-gray-300">
                <span className="font-semibold text-purple-400">60-90 day first-mover advantage</span> - 
                Start relationship building before competitors know opportunities exist
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Predicted Opportunities */}
          <Card className="lg:col-span-2 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  High-Confidence Predictions (Next 90 Days)
                </span>
                <Badge variant="outline">
                  {opportunities.length} opportunities
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full">
                <div className="space-y-4">
                  {opportunities.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      No predictions available. Start the Predictive Intelligence Agent to see 60-90 day forecasts.
                    </div>
                  ) : (
                    opportunities.map((opportunity) => (
                      <div key={opportunity.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{opportunity.entity}</h3>
                            <p className="text-gray-300 text-sm mb-2">{opportunity.predictedRFP}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{opportunity.entityType}</span>
                              <span>•</span>
                              <span>{opportunity.sport}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`px-2 py-1 rounded text-xs text-white ${getConfidenceColor(opportunity.confidence)}`}>
                              {getConfidenceText(opportunity.confidence)}
                            </div>
                            <div className="text-sm font-semibold mt-2">{opportunity.estimatedValue}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Timeline:</span>
                            <span className="ml-2">{opportunity.timeline}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Confidence:</span>
                            <span className="ml-2">{opportunity.confidence}%</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-sm text-gray-400 mb-1">Strategic Advantage:</div>
                          <div className="text-xs text-green-400">{opportunity.strategicAdvantage}</div>
                        </div>

                        <Separator className="my-3 bg-gray-600" />

                        <div>
                          <div className="text-sm text-gray-400 mb-2">Evidence:</div>
                          <div className="space-y-1">
                            {opportunity.evidence.primary.slice(0, 2).map((evidence, idx) => (
                              <div key={idx} className="text-xs text-gray-300">
                                • {evidence}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-sm text-gray-400 mb-2">Recommended Actions:</div>
                          <div className="space-y-1">
                            {opportunity.recommendedActions.slice(0, 2).map((action, idx) => (
                              <div key={idx} className="text-xs text-blue-400">
                                {idx + 1}. {action}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Analysis Logs */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Analysis Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full">
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      No analysis logs yet. Start the Predictive Intelligence Agent to see real-time analysis.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          {log.type === 'system' && <Brain className="h-3 w-3 text-purple-400" />}
                          {log.type === 'pattern' && <BarChart3 className="h-3 w-3 text-blue-400" />}
                          {log.type === 'theory' && <Lightbulb className="h-3 w-3 text-yellow-400" />}
                          {log.type === 'evidence' && <Eye className="h-3 w-3 text-green-400" />}
                          {log.type === 'prediction' && <Target className="h-3 w-3 text-red-400" />}
                          <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300">{log.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Alert className="bg-gray-800 border-gray-700">
          <Brain className="h-4 w-4" />
          <AlertDescription className="text-gray-300">
            <strong>🔮 Predictive Intelligence System:</strong> Goes beyond reactive RFP detection to provide 
            <strong>60-90 day competitive advantage</strong>. Based on your proven historical analysis (85% accuracy), 
            this system predicts opportunities before they're announced using pattern recognition, theory generation, 
            and evidence validation. Currently tracking {status?.activePatterns || 0} patterns with 
            {(status?.modelAccuracy || 0)}% prediction accuracy.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}