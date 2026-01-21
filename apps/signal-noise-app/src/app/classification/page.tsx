'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ClassificationReport {
  report: string
  timestamp: string
}

interface Stats {
  success: boolean
  message: string
  report: ClassificationReport
  timestamp: string
}

export default function ClassificationPage() {
  const [report, setReport] = useState<ClassificationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<Stats | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchClassificationReport()
  }, [])

  const fetchClassificationReport = async () => {
    try {
      const response = await fetch('/api/classify-entities')
      const data = await response.json()
      setReport(data)
    } catch (error) {
      console.error('Failed to fetch classification report:', error)
    }
  }

  const runClassification = async (batchSize: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/classify-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize })
      })
      const result = await response.json()
      setLastResult(result)
      
      if (result.success) {
        await fetchClassificationReport()
      }
    } catch (error) {
      console.error('Classification failed:', error)
      setLastResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Classification failed',
        report: { report: '', timestamp: '' },
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const parseClassificationStats = (reportText: string) => {
    const lines = reportText.split('\n')
    const typeCounts: Record<string, number> = {}
    
    lines.forEach(line => {
      const match = line.match(/- \*\*([^*]+)\*\*: (\d+) \((\d+\.\d+)%\)/)
      if (match) {
        typeCounts[match[1]] = parseInt(match[2])
      }
    })
    
    return typeCounts
  }

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'Club': 'bg-green-500',
      'Federation': 'bg-blue-500',
      'Organization': 'bg-purple-500',
      'League': 'bg-orange-500',
      'Tournament': 'bg-red-500',
      'Team': 'bg-cyan-500',
      'Venue': 'bg-pink-500',
      'Person': 'bg-gray-500',
      'Brand': 'bg-yellow-500',
      'Media': 'bg-indigo-500',
      'Technology': 'bg-teal-500',
      'Unknown': 'bg-gray-400'
    }
    return colors[type] || 'bg-gray-400'
  }

  const unknownCount = report ? parseClassificationStats(report.report)['Unknown'] || 0 : 0
  const totalCount = report ? Object.values(parseClassificationStats(report.report)).reduce((a, b) => a + b, 0) : 0
  const classifiedPercentage = totalCount > 0 ? ((totalCount - unknownCount) / totalCount * 100).toFixed(1) : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entity Classification Management</h1>
          <p className="text-muted-foreground">
            Automatically categorize unknown entities in the sports intelligence database
          </p>
        </div>
        <Button 
          onClick={() => fetchClassificationReport()}
          variant="outline"
          disabled={loading}
        >
          Refresh Report
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Classification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Classified</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {classifiedPercentage}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Unknown</span>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {unknownCount}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <Badge variant="outline">{totalCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={() => runClassification(50)} 
              disabled={loading}
              className="w-full"
              size="sm"
            >
              Classify 50 Entities
            </Button>
            <Button 
              onClick={() => runClassification(100)} 
              disabled={loading}
              className="w-full"
              size="sm"
              variant="outline"
            >
              Classify 100 Entities
            </Button>
            <Button 
              onClick={() => runClassification(200)} 
              disabled={loading}
              className="w-full"
              size="sm"
              variant="outline"
            >
              Classify 200 Entities
            </Button>
            <Button 
              onClick={() => runClassification(500)} 
              disabled={loading}
              className="w-full"
              size="sm"
              variant="outline"
            >
              Classify 500 Entities
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last Result</CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    lastResult.success ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm">
                    {lastResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastResult.message}
                </p>
                {lastResult.success && (
                  <p className="text-xs text-green-600">
                    ✓ {lastResult.report.report.split('\n').find(line => 
                      line.includes('Successfully classified')
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No classification runs yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-xs text-muted-foreground">Classifying entities...</p>
              </div>
            )}
            {!loading && report && (
              <div className="text-sm text-muted-foreground">
                Ready for next classification run
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="report">Full Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {report && (
            <Card>
              <CardHeader>
                <CardTitle>Classification Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(parseClassificationStats(report.report))
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 border rounded">
                        <span className="font-medium">{type}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{count}</span>
                          <Badge className={getTypeColor(type)}>
                            {((count / totalCount) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          {report && (
            <Card>
              <CardHeader>
                <CardTitle>Full Classification Report</CardTitle>
                <CardDescription>
                  Last updated: {new Date(report.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap">
                    {report.report}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">🔍 Pattern Recognition</h4>
              <p className="text-muted-foreground">
                The system analyzes entity names, descriptions, and properties to identify patterns that indicate entity types.
              </p>
            </div>
            <div>
              <h4 className="font-medium">🎯 Confidence Scoring</h4>
              <p className="text-muted-foreground">
                Each classification includes a confidence score (0.1-0.9). Only entities with 50%+ confidence are updated.
              </p>
            </div>
            <div>
              <h4 className="font-medium">📊 Types Detected</h4>
              <p className="text-muted-foreground">
                Clubs, Federations, Organizations, Leagues, Tournaments, Teams, Venues, People, Brands, Media, Technology
              </p>
            </div>
            <div>
              <h4 className="font-medium">⚡ Performance</h4>
              <p className="text-muted-foreground">
                Batch processing of 50-500 entities at a time to maintain system performance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}