'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface RFPOpportunity {
  id: string;
  entityName: string;
  entityType: string;
  title: string;
  description: string;
  estimatedValue: string;
  rfpType: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  strategicValue: number;
  contactInfo?: string;
  nextSteps?: string[];
  deadline?: string;
  source: string;
}

interface AnalysisResult {
  sessionId: string;
  entitiesProcessed: number;
  processingTime: number;
  chunks: Array<{
    chunk: number;
    entities: string;
    analysis: string;
    processedAt: string;
  }>;
  sessionSummary: any;
  timestamp: string;
}

export default function RFPIntelligenceDashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [currentResults, setCurrentResults] = useState<AnalysisResult | null>(null);
  const [opportunities, setOpportunities] = useState<RFPOpportunity[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLiveLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const startRFPScan = async () => {
    // Prevent multiple concurrent scans
    if (isScanning) {
      addLog('⚠️ Scan already in progress...');
      return;
    }
    
    setIsScanning(true);
    setScanProgress(0);
    setLiveLogs([]);
    setOpportunities([]);
    
    addLog('🚀 Starting RFP Intelligence Scan...');
    
    try {
      const eventSource = new EventSource(
        '/api/claude-agent-demo/stream?service=reliable&query=Sports%20RFP%20opportunities&mode=batch&entityLimit=3'
      );

      eventSource.onmessage = (event) => {
        try {
          console.log('🔍 SSE Event received:', event.data.substring(0, 200));
          const data = JSON.parse(event.data);
          console.log('🔍 Parsed SSE event type:', data.type, 'message:', data.message);
          
          if (data.type === 'entity_search_start') {
            console.log('✅ Handling entity_search_start event');
            addLog(`🔍 ${data.message}`);
            setScanProgress(prev => Math.min(prev + 10, 90)); // Update progress
          } else if (data.type === 'entity_search_complete') {
            console.log('✅ Handling entity_search_complete event');
            addLog(`✅ ${data.message}`);
            setScanProgress(prev => Math.min(prev + 10, 90)); // Update progress
          } else if (data.type === 'entity_search_error') {
            console.log('✅ Handling entity_search_error event');
            addLog(`❌ ${data.message}`);
          } else if (data.type === 'progress') {
            addLog(`📊 ${data.message}`);
            
            // Check if this is a BrightData search event (fallback for wrapped events)
            if (data.message?.includes('Starting BrightData search')) {
              addLog(`🔍 ${data.message}`);
              setScanProgress(prev => Math.min(prev + 5, 85));
            } else if (data.message?.includes('BrightData search completed')) {
              addLog(`✅ ${data.message}`);
              setScanProgress(prev => Math.min(prev + 5, 85));
            }
            
            if (data.sessionState?.completedChunks && data.sessionState?.totalChunks) {
              const progress = (data.sessionState.completedChunks / data.sessionState.totalChunks) * 100;
              setScanProgress(progress);
              addLog(`📈 Progress: ${Math.round(progress)}%`);
            }
          } else if (data.type === 'chunk_complete') {
            addLog(`✅ ${data.message}`);
            
            // Update progress for chunk completion
            if (data.sessionState?.completedChunks && data.sessionState?.totalChunks) {
              const progress = (data.sessionState.completedChunks / data.sessionState.totalChunks) * 100;
              setScanProgress(progress);
            }
          } else if (data.type === 'analysis_complete') {
            addLog(`🎉 ${data.message}`);
            setScanProgress(100);
          } else if (data.type === 'success') {
            addLog(`✅ ${data.message}`);
            if (data.metadata?.entitiesProcessed) {
              addLog(`📊 Processed ${data.metadata.entitiesProcessed} entities in ${Math.round(data.metadata.executionTime/1000)}s`);
            }
          } else if (data.type === 'log') {
            addLog(`📝 ${data.message}`);
          } else if (data.type === 'heartbeat') {
            // Skip heartbeat in main log, only show in console
            console.log(`💓 Heartbeat: ${data.message}`);
          } else if (data.type === 'final') {
            console.log('🏁 Final data received:', data);
            setCurrentResults(data.data);
            addLog(`🎯 Analysis complete! Found ${data.data.totalFound || 0} results`);
          } else {
            // Catch-all for any other event types
            console.log(`🔍 Unhandled SSE event type: ${data.type}`, data);
            addLog(`🔍 [${data.type}] ${data.message || data.type}`);
          }
        } catch (error) {
          console.error('❌ Error parsing SSE data:', error, 'Raw data:', event.data);
          addLog(`❌ Error parsing server response`);
        }
      };

      eventSource.addEventListener('result', (event) => {
        try {
          const data = JSON.parse(event.data);
          setCurrentResults(data);
          addLog(`🎉 Scan complete! Found ${opportunities.length} opportunities`);
          setIsScanning(false);
          setScanProgress(100);
          eventSource.close();
        } catch (error) {
          console.error('Error parsing final result:', error);
          setIsScanning(false);
          eventSource.close();
        }
      });

      eventSource.onerror = (error) => {
        console.error('❌ SSE Error:', error);
        addLog('❌ Streaming connection lost. Retrying...');
        setIsScanning(false);
        eventSource.close();
        
        // Auto-retry after 3 seconds
        setTimeout(() => {
          if (!isScanning) {
            addLog('🔄 Auto-retrying...');
            startRFPScan();
          }
        }, 3000);
      };

      eventSource.addEventListener('heartbeat', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`💓 Connection alive (${data.progress || 0}min elapsed)`);
        } catch (error) {
          addLog(`💓 Connection maintained`);
        }
      });

      eventSource.addEventListener('completed', () => {
        eventSource.close();
      });

    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
      setIsScanning(false);
    }
  };

  const testSSE = () => {
    addLog('🧪 Testing SSE connection...');
    
    const eventSource = new EventSource('/api/test-sse');
    
    eventSource.onopen = () => {
      addLog('✅ SSE connection opened successfully');
    };
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addLog(`📨 SSE Event: ${data.type} - ${data.message || ''}`);
      
      if (data.type === 'progress') {
        addLog(`📊 ${data.message} (${data.progress}%)`);
      }
    };
    
    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      addLog(`📊 ${data.message} (${data.progress}%)`);
    });
    
    eventSource.addEventListener('result', (event) => {
      const data = JSON.parse(event.data);
      addLog(`✅ SSE Test Complete: ${data.message}`);
      eventSource.close();
    });
    
    eventSource.onerror = (error) => {
      addLog(`❌ SSE Error: ${error}`);
      eventSource.close();
    };
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (eventSource.readyState !== 2) {
        addLog('⏰ SSE test timeout');
        eventSource.close();
      }
    }, 10000);
  };

  const checkResults = async () => {
    addLog('🔍 Checking for completed results...');
    
    try {
      const response = await fetch('/api/test-simple');
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const latestResult = data.data[0];
        addLog(`✅ Found ${data.data.length} completed scan(s)`);
        addLog(`📊 Latest: ${latestResult.entities_processed} entities processed`);
        addLog(`⏱️ Processing time: ${Math.round(latestResult.processing_time/1000)}s`);
        addLog(`📅 Completed: ${new Date(latestResult.timestamp).toLocaleString()}`);
        
        setCurrentResults(latestResult);
        setScanProgress(100);
        
        // Extract opportunities if available
        if (latestResult.results) {
          const extractedOpps = extractOpportunitiesFromAnalysis(latestResult);
          setOpportunities(extractedOpps);
          addLog(`🎯 Found ${extractedOpps.length} opportunities`);
        }
        
      } else {
        addLog('❌ No completed scans found');
      }
    } catch (error) {
      addLog(`❌ Error checking results: ${error.message}`);
    }
  };

  const extractOpportunitiesFromAnalysis = (data: any): RFPOpportunity[] => {
    const opportunities: RFPOpportunity[] = [];
    
    if (data.results) {
      data.results.forEach((result: any) => {
        if (result.result) {
          result.result.forEach((chunk: any) => {
            // Extract opportunities from analysis text
            const analysis = chunk.analysis;
            const lines = analysis.split('\n');
            
            lines.forEach((line: string, index: number) => {
              if (line.includes('$') || line.includes('USD') || line.includes('budget')) {
                const opp: RFPOpportunity = {
                  id: `opp-${Date.now()}-${index}`,
                  entityName: chunk.entities,
                  entityType: 'Sports Organization',
                  title: extractTitle(analysis, index),
                  description: extractDescription(analysis, index),
                  estimatedValue: extractValue(line),
                  rfpType: extractRFPType(analysis),
                  priority: extractPriority(analysis),
                  strategicValue: calculateStrategicValue(analysis),
                  source: 'AI Analysis',
                  nextSteps: extractNextSteps(analysis)
                };
                opportunities.push(opp);
              }
            });
          });
        }
      });
    }
    
    return opportunities;
  };

  const extractTitle = (analysis: string, index: number): string => {
    const lines = analysis.split('\n');
    return lines[index] || 'Digital Transformation Opportunity';
  };

  const extractDescription = (analysis: string, index: number): string => {
    return analysis.substring(0, 200) + '...';
  };

  const extractValue = (line: string): string => {
    const valueMatch = line.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    return valueMatch ? `$${valueMatch[1]}` : '$50,000-150,000';
  };

  const extractRFPType = (analysis: string): string => {
    if (analysis.toLowerCase().includes('digital')) return 'Digital Transformation';
    if (analysis.toLowerCase().includes('infrastructure')) return 'Infrastructure';
    if (analysis.toLowerCase().includes('software')) return 'Software Implementation';
    return 'General Services';
  };

  const extractPriority = (analysis: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
    if (analysis.toLowerCase().includes('high') || analysis.toLowerCase().includes('major')) return 'HIGH';
    if (analysis.toLowerCase().includes('medium')) return 'MEDIUM';
    return 'LOW';
  };

  const calculateStrategicValue = (analysis: string): number => {
    let score = 50;
    if (analysis.toLowerCase().includes('football')) score += 20;
    if (analysis.toLowerCase().includes('broadcast')) score += 15;
    if (analysis.toLowerCase().includes('digital')) score += 10;
    if (analysis.toLowerCase().includes('transformation')) score += 10;
    return Math.min(score, 100);
  };

  const extractNextSteps = (analysis: string): string[] => {
    const steps: string[] = [];
    if (analysis.toLowerCase().includes('contact')) steps.push('Direct outreach recommended');
    if (analysis.toLowerCase().includes('monitor')) steps.push('Ongoing monitoring required');
    if (analysis.toLowerCase().includes('proposal')) steps.push('Prepare proposal materials');
    return steps;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const totalEstimatedValue = opportunities.reduce((sum, opp) => {
    const value = parseInt(opp.estimatedValue.replace(/[^0-9]/g, '')) || 0;
    return sum + value;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
            RFP Intelligence Dashboard
          </h1>
          <p className="text-gray-400 mb-4">
            Real-time RFP opportunity discovery and analysis using AI-powered web intelligence
          </p>
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4">
            <p className="text-yellow-400 text-sm">
              <strong>📌 Note:</strong> If the scan progress gets stuck at 0%, the backend is still processing. 
              Click "🔍 Check Results" after 2-3 minutes to see completed analysis.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <Card className="bg-gray-900 border-gray-800 mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={startRFPScan}
                  disabled={isScanning}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isScanning ? '🔍 Scanning...' : '🚀 Start RFP Intelligence Scan'}
                </Button>
                <Button
                  onClick={checkResults}
                  disabled={isScanning}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  🔍 Check Results
                </Button>
                <Button
                  onClick={testSSE}
                  disabled={isScanning}
                  variant="outline"
                  className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                >
                  🧪 Test SSE
                </Button>
                <span className="text-sm text-gray-400">
                  Scan 3 sports entities for RFP opportunities
                </span>
              </div>
              
              {isScanning && (
                <div className="flex items-center gap-4">
                  <div className="w-48">
                    <Progress value={scanProgress} className="h-2" />
                  </div>
                  <span className="text-sm text-gray-400">
                    {Math.round(scanProgress)}%
                  </span>
                </div>
              )}
            </div>

            {/* Live Logs */}
            {isScanning && (
              <div className="mt-4">
                <div className="bg-black rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs">
                  {liveLogs.map((log, index) => (
                    <div key={index} className="text-green-400 mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overview Stats */}
        {opportunities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-blue-400">
                  {opportunities.length}
                </div>
                <div className="text-sm text-gray-400">Opportunities Found</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-green-400">
                  ${(totalEstimatedValue / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-400">Total Estimated Value</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-purple-400">
                  {currentResults?.entitiesProcessed || 0}
                </div>
                <div className="text-sm text-gray-400">Entities Analyzed</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-yellow-400">
                  {Math.round(((currentResults?.processingTime || 0) / 1000) / 60)}m
                </div>
                <div className="text-sm text-gray-400">Processing Time</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Opportunities Grid */}
        {opportunities.length > 0 && (
          <Tabs defaultValue="opportunities" className="mb-8">
            <TabsList className="bg-gray-900 border-gray-800">
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
              <TabsTrigger value="analysis">Analysis Details</TabsTrigger>
              <TabsTrigger value="insights">Strategic Insights</TabsTrigger>
            </TabsList>
            
            <TabsContent value="opportunities" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {opportunities.map((opportunity) => (
                  <Card key={opportunity.id} className="bg-gray-900 border-gray-800 hover:border-blue-600 transition-colors">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                        <Badge className={getPriorityColor(opportunity.priority)}>
                          {opportunity.priority}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400">
                        {opportunity.entityName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Estimated Value</div>
                          <div className="text-xl font-bold text-green-400">
                            {opportunity.estimatedValue}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Type</div>
                          <Badge variant="outline" className="border-blue-600 text-blue-400">
                            {opportunity.rfpType}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Strategic Value</div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                              style={{ width: `${opportunity.strategicValue}%` }}
                            />
                          </div>
                        </div>
                        
                        {opportunity.nextSteps && opportunity.nextSteps.length > 0 && (
                          <div>
                            <div className="text-sm text-gray-400 mb-2">Next Steps</div>
                            <ul className="text-sm space-y-1">
                              {opportunity.nextSteps.map((step, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <span className="text-blue-400">•</span>
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="analysis" className="mt-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle>Detailed Analysis Results</CardTitle>
                  <CardDescription>
                    Raw AI analysis from the intelligence scan
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentResults?.results?.map((result: any, index: number) => (
                    <div key={index} className="mb-6 p-4 bg-gray-800 rounded-lg">
                      <h3 className="font-bold mb-2">Chunk {result.chunk}: {result.entities}</h3>
                      <p className="text-gray-300 whitespace-pre-wrap">{result.analysis}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="insights" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>🎯 Top Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {opportunities
                        .filter(opp => opp.priority === 'HIGH')
                        .slice(0, 5)
                        .map((opp, index) => (
                          <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                            <div>
                              <div className="font-semibold">{opp.title}</div>
                              <div className="text-sm text-gray-400">{opp.entityName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-400">{opp.estimatedValue}</div>
                              <div className="text-xs text-gray-400">{opp.rfpType}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle>📊 Intelligence Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">High Priority Opportunities</span>
                        <span className="font-bold">
                          {opportunities.filter(opp => opp.priority === 'HIGH').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Digital Transformation Projects</span>
                        <span className="font-bold">
                          {opportunities.filter(opp => opp.rfpType === 'Digital Transformation').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Average Strategic Value</span>
                        <span className="font-bold">
                          {Math.round(opportunities.reduce((sum, opp) => sum + opp.strategicValue, 0) / opportunities.length)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Processing Efficiency</span>
                        <span className="font-bold">
                          {Math.round((currentResults?.entitiesProcessed || 0) / ((currentResults?.processingTime || 1) / 1000))} entities/min
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {!isScanning && opportunities.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">No RFP Intelligence Available</h3>
              <p className="text-gray-400 mb-6">
                Start an RFP Intelligence Scan to discover real-time opportunities from sports organizations worldwide.
              </p>
              <Button
                onClick={startRFPScan}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                🚀 Start Your First Scan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}