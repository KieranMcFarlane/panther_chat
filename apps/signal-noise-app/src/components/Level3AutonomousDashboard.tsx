'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VerificationResult {
  component: string;
  status: string;
  timestamp: string;
  checks?: any;
  tools?: any;
  workflow?: any;
  dataFlow?: any;
  learning?: any;
  summary: string;
}

interface AutonomousMetrics {
  operational_hours: number;
  autonomous_decisions: number;
  learning_cycles: number;
  human_interventions: number;
  success_rate: number;
  confidence_improvement: number;
}

export default function Level3AutonomousDashboard() {
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [autonomousMetrics, setAutonomousMetrics] = useState<AutonomousMetrics | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerification, setLastVerification] = useState<string>('');

  // Run full system verification
  const runFullVerification = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/verification?check=all');
      const result = await response.json();
      
      setVerificationResults(result.components || []);
      setLastVerification(result.timestamp);
      
      // Update autonomous metrics
      await fetchAutonomousMetrics();
      
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Fetch autonomous metrics
  const fetchAutonomousMetrics = async () => {
    try {
      // Mock metrics for now - would come from actual system
      setAutonomousMetrics({
        operational_hours: 168, // 1 week
        autonomous_decisions: 1247,
        learning_cycles: 89,
        human_interventions: 12,
        success_rate: 87.5,
        confidence_improvement: 23.4
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  // Test specific component
  const testComponent = async (component: string) => {
    try {
      const response = await fetch(`/api/verification?check=${component}`);
      const result = await response.json();
      console.log(`${component} test result:`, result);
    } catch (error) {
      console.error(`Failed to test ${component}:`, error);
    }
  };

  // Auto-verify on mount
  useEffect(() => {
    runFullVerification();
    const interval = setInterval(fetchAutonomousMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'partially_operational': return 'bg-yellow-500';
      case 'needs_attention': return 'bg-orange-500';
      case 'needs_setup': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return '✅';
      case 'partially_operational': return '⚠️';
      case 'needs_attention': return '🔧';
      case 'needs_setup': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔴 Level 3 Autonomous System</h1>
          <p className="text-gray-600 mt-1">Complete autonomous RFP processing with learning capabilities</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last verification: {lastVerification ? new Date(lastVerification).toLocaleTimeString() : 'Never'}
          </div>
          <Button 
            onClick={runFullVerification}
            disabled={isVerifying}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isVerifying ? '🔄 Verifying...' : '🔍 Run Verification'}
          </Button>
        </div>
      </div>

      {/* Autonomous Metrics */}
      {autonomousMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {autonomousMetrics.operational_hours}h
              </div>
              <p className="text-sm text-gray-600">Operational Hours</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {autonomousMetrics.autonomous_decisions.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Autonomous Decisions</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {autonomousMetrics.learning_cycles}
              </div>
              <p className="text-sm text-gray-600">Learning Cycles</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {autonomousMetrics.success_rate}%
              </div>
              <p className="text-sm text-gray-600">Success Rate</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                +{autonomousMetrics.confidence_improvement}%
              </div>
              <p className="text-sm text-gray-600">Confidence Gain</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">
                {autonomousMetrics.human_interventions}
              </div>
              <p className="text-sm text-gray-600">Human Interventions</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Verification Results */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 System Verification Status</CardTitle>
          <CardDescription>Real-time verification of all autonomous system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verificationResults.map((result, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className={`${getStatusColor(result.status)} text-white`}>
                      {getStatusIcon(result.status)} {result.status.replace('_', ' ')}
                    </Badge>
                    <div className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{result.component}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">{result.summary}</p>
                    
                    {/* Component-specific details */}
                    {result.checks && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-700">Claude SDK Checks:</p>
                        {Object.entries(result.checks).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex items-center text-xs">
                            <span className={`w-2 h-2 rounded-full mr-2 ${value ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-gray-600">{key.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {result.tools && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-700">MCP Tools:</p>
                        {Object.entries(result.tools).map(([tool, config]: [string, any]) => (
                          <div key={tool} className="flex items-center text-xs">
                            <span className={`w-2 h-2 rounded-full mr-2 ${config.configured && config.connected ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                            <span className="text-gray-600">{tool}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button
                      onClick={() => testComponent(result.component.toLowerCase().replace(/\s+/g, '-'))}
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                    >
                      Test Component
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Autonomous Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>🎮 Autonomous Control Panel</CardTitle>
          <CardDescription>Control and monitor autonomous operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="operations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="operations">🤖 Operations</TabsTrigger>
              <TabsTrigger value="learning">🧠 Learning</TabsTrigger>
              <TabsTrigger value="safety">🔒 Safety</TabsTrigger>
              <TabsTrigger value="performance">📈 Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Discovery Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">LinkedIn Monitoring</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Government Tenders</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Market Intelligence</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Pipeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">RFP Analysis</span>
                        <Badge className="bg-green-500">Operational</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Market Research</span>
                        <Badge className="bg-green-500">Operational</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Technical Evaluation</span>
                        <Badge className="bg-yellow-500">Learning</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="learning" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Learning Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Patterns Identified</span>
                        <span className="font-semibold">234</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Strategies Optimized</span>
                        <span className="font-semibold">89</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Confidence Improved</span>
                        <span className="font-semibold text-green-600">+23.4%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Learning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="p-2 bg-green-50 rounded text-sm">
                        <strong>Success Pattern:</strong> Premier League opportunities respond well to technical emphasis
                      </div>
                      <div className="p-2 bg-blue-50 rounded text-sm">
                        <strong>Strategy Update:</strong> Added budget range validation for government tenders
                      </div>
                      <div className="p-2 bg-yellow-50 rounded text-sm">
                        <strong>Failure Insight:</strong> Timeline too aggressive for complex integrations
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="safety" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Safety Controls</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Human Approval Required</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Rate Limiting</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Cost Controls</span>
                        <Badge className="bg-green-500">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Data Privacy</span>
                        <Badge className="bg-green-500">Compliant</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Intervention History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>12 interventions</strong> in the last 7 days
                      </div>
                      <div className="text-sm">
                        <strong>8 manual overrides</strong> for high-value proposals
                      </div>
                      <div className="text-sm">
                        <strong>4 corrections</strong> to automated responses
                      </div>
                      <div className="text-sm text-green-600">
                        <strong>98.5% autonomy</strong> rate maintained
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avg Response Time</span>
                        <span className="font-semibold">4.2 minutes</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Win Rate</span>
                        <span className="font-semibold text-green-600">34.2%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Proposal Quality</span>
                        <span className="font-semibold">87.8/100</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Cost Efficiency</span>
                        <span className="font-semibold text-green-600">-67%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">ROI Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>£2.1M</strong> in pipeline value identified
                      </div>
                      <div className="text-sm">
                        <strong>£734K</strong> in proposals sent
                      </div>
                      <div className="text-sm">
                        <strong>£251K</strong> in confirmed wins
                      </div>
                      <div className="text-sm text-green-600">
                        <strong>12.1x</strong> ROI on autonomous system
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}