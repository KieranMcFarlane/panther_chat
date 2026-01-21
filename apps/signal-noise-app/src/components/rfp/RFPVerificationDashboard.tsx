/**
 * RFP Verification Dashboard
 * 
 * Real-time dashboard for monitoring headless RFP verification
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Monitor, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Target,
  Play,
  Pause,
  RefreshCw,
  Eye,
  MousePointer,
  Camera,
  Brain
} from 'lucide-react';

interface VerificationStats {
  total_verified: number;
  verified: number;
  failed: number;
  not_verified: number;
  average_authenticity: number;
  recent_verifications: any[];
}

interface VerificationResult {
  id: string;
  title: string;
  organization: string;
  verification_status: string;
  authenticity_score: number;
  verified_at: string;
  verification_interactions: string[];
  verification_screenshots: string[];
}

export function RFPVerificationDashboard() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedRFP, setSelectedRFP] = useState<VerificationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'queue'>('overview');

  useEffect(() => {
    fetchVerificationStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchVerificationStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchVerificationStats = async () => {
    try {
      const response = await fetch('/api/rfp-verification');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch verification stats:', error);
    }
  };

  const startBatchVerification = async () => {
    setIsVerifying(true);
    
    try {
      // Get unverified RFPs
      const response = await fetch('/api/tenders?action=opportunities&limit=20');
      const data = await response.json();
      
      const unverifiedRFPs = data.opportunities.filter(opp => 
        opp.verification_status !== 'verified'
      ).slice(0, 5); // Start with 5

      if (unverifiedRFPs.length > 0) {
        const batchConfigs = unverifiedRFPs.map(opp => ({
          url: opp.source_url || '',
          organization_name: opp.organization,
          organization_type: 'club' // Default type
        }));

        const verificationResponse = await fetch('/api/rfp-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'batch_verify_rfps',
            batchConfigs: batchConfigs.filter(config => config.url), // Only include valid URLs
            businessInfo: {
              contact_name: 'Yellow Panther Business Development',
              email: 'business@yellowpanther.com',
              phone: '+44-20-1234-5678',
              company: 'Yellow Panther Digital Studio'
            }
          }),
        });

        const result = await verificationResponse.json();
        console.log('Batch verification result:', result);
        
        // Refresh stats
        await fetchVerificationStats();
      }
    } catch (error) {
      console.error('Batch verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const verifySingleRFP = async (rfp: VerificationResult) => {
    try {
      const response = await fetch('/api/rfp-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify_single_rfp',
          rfpId: rfp.id,
          rfpUrl: rfp.source_url,
          organizationInfo: {
            name: rfp.organization,
            type: 'club'
          },
          businessInfo: {
            contact_name: 'Yellow Panther Business Development',
            email: 'business@yellowpanther.com',
            phone: '+44-20-1234-5678',
            company: 'Yellow Panther Digital Studio'
          }
        }),
      });

      const result = await response.json();
      console.log('Single verification result:', result);
      
      // Refresh stats
      await fetchVerificationStats();
    } catch (error) {
      console.error('Single RFP verification failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getAuthenticityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Monitor className="w-8 h-8 text-blue-600" />
            RFP Verification Dashboard
          </h1>
          <p className="text-muted-foreground">
            Headless browser verification for RFP authenticity and lead generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={startBatchVerification}
            disabled={isVerifying}
            className="flex items-center gap-2"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Batch Verification
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchVerificationStats}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === 'results' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('results')}
        >
          Results
        </Button>
        <Button
          variant={activeTab === 'queue' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('queue')}
        >
          Queue
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Verified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_verified}</div>
                <div className="text-xs text-muted-foreground mt-1">RFPs processed</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Successfully Verified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
                <div className="text-xs text-green-600 mt-1">Authentic RFPs</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-red-600 mt-1">Invalid/404 RFPs</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Authenticity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getAuthenticityColor(stats.average_authenticity)}`}>
                  {stats.average_authenticity}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Confidence score</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Verifications */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Authenticity</TableHead>
                    <TableHead>Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_verifications.map((rfp, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{rfp.organization_name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(rfp.verification_status)}>
                          {getStatusIcon(rfp.verification_status)}
                          {rfp.verification_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={getAuthenticityColor(rfp.authenticity_score)}>
                          {rfp.authenticity_score}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(rfp.verified_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && stats && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recent_verifications.map((rfp, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{rfp.title || rfp.organization_name}</h3>
                          <p className="text-sm text-muted-foreground">{rfp.organization_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(rfp.verification_status)}>
                            {rfp.verification_status}
                          </Badge>
                          {rfp.authenticity_score && (
                            <Badge variant="outline">
                              {rfp.authenticity_score}% Authentic
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {rfp.verification_interactions && rfp.verification_interactions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <MousePointer className="w-4 h-4" />
                            Interactions:
                          </h4>
                          <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                            {rfp.verification_interactions.map((interaction, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                {interaction}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {rfp.verification_screenshots && rfp.verification_screenshots.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <Camera className="w-4 h-4" />
                            Screenshots:
                          </h4>
                          <div className="flex gap-2">
                            {rfp.verification_screenshots.map((screenshot, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRFP(rfp)}
                                className="flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                View {idx + 1}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Verification Queue Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Queue Status</h4>
                  <p className="text-sm text-blue-700">
                    Automatic verification is running for new RFPs. The system prioritizes high-value opportunities 
                    with valid URLs and recent deadlines.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.not_verified || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">In Queue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.average_authenticity || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      15s
                    </div>
                    <div className="text-sm text-muted-foreground">Avg. Time</div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <Button
                    onClick={startBatchVerification}
                    disabled={isVerifying}
                    className="flex items-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing Queue...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4" />
                        Process Queue Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected RFP Detail Modal */}
      {selectedRFP && (
        <Card className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Verification Details
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedRFP(null)}
                >
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold mb-2">{selectedRFP.title || selectedRFP.organization_name}</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Screenshots</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRFP.verification_screenshots?.map((screenshot, idx) => (
                      <div key={idx} className="border rounded p-2">
                        <div className="text-xs text-gray-500 mb-1">Screenshot {idx + 1}</div>
                        <img 
                          src={screenshot} 
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full h-48 object-cover rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Interaction Log</h4>
                  <div className="bg-gray-50 p-3 rounded font-mono text-xs">
                    {selectedRFP.verification_interactions?.map((interaction, idx) => (
                      <div key={idx} className="mb-1">
                        {new Date().toLocaleTimeString()}: {interaction}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}
    </div>
  );
}