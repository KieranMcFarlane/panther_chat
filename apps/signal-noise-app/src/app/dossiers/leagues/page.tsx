'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Download, Eye, FileText, Clock, TrendingUp, Globe, Database, Search, ExternalLink, Trophy, Building2, Target, BarChart3, Zap } from 'lucide-react';

interface Dossier {
  name: string;
  filename: string;
  size: number;
  lastModified: string;
  type: 'dossier' | 'summary';
}

interface DossierData {
  dossiers: Dossier[];
  totalFiles: number;
  lastUpdated: string | null;
}

export default function LeagueDossiersPage() {
  const [dossiers, setDossiers] = useState<DossierData | null>(null);
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [dossierContent, setDossierContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDossiers();
  }, []);

  const fetchDossiers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dossiers/leagues');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dossiers: ${response.status}`);
      }
      
      const data = await response.json();
      setDossiers(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dossiers');
    } finally {
      setLoading(false);
    }
  };

  const fetchDossierContent = async (dossierName: string) => {
    try {
      const response = await fetch(`/api/dossiers/leagues?dossier=${encodeURIComponent(dossierName)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dossier: ${response.status}`);
      }
      
      const data = await response.json();
      setDossierContent(data.content);
      setSelectedDossier(dossierName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dossier content');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDossierIcon = (dossierName: string) => {
    if (dossierName.toLowerCase().includes('premier')) return '⚪';
    if (dossierName.toLowerCase().includes('champions')) return '🏆';
    if (dossierName.toLowerCase().includes('indian')) return '🏏';
    if (dossierName.toLowerCase().includes('australian')) return '🏉';
    if (dossierName.toLowerCase().includes('summary')) return '📊';
    return '📋';
  };

  const getOpportunityScore = (dossierName: string): number => {
    if (dossierName.toLowerCase().includes('premier')) return 95;
    if (dossierName.toLowerCase().includes('champions')) return 93;
    if (dossierName.toLowerCase().includes('indian')) return 91;
    if (dossierName.toLowerCase().includes('australian')) return 86;
    return 0;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 90) return 'bg-red-500';
    if (score >= 80) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getPriorityColorClass = (score: number) => {
    if (score >= 90) return 'bg-red-100 text-red-800 border-red-200';
    if (score >= 80) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-primary animate-spin" />
                <h1 className="text-3xl font-bold">League Intelligence Dossiers</h1>
              </div>
            </div>
            <p className="text-muted-foreground">
              Loading league intelligence dossiers...
            </p>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading league intelligence dossiers...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">League Intelligence Dossiers</h1>
              </div>
            </div>
            <p className="text-muted-foreground">
              Strategic intelligence analysis for major sports leagues and competitions
            </p>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 font-medium">Error loading dossiers</p>
                <p className="text-gray-600 mt-2">{error}</p>
                <Button onClick={fetchDossiers} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!dossiers || dossiers.dossiers.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">League Intelligence Dossiers</h1>
              </div>
            </div>
            <p className="text-muted-foreground">
              Strategic intelligence analysis for major sports leagues and competitions
            </p>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No League Dossiers Found</h2>
            <p className="text-gray-600 mb-6">
              League intelligence dossiers will appear here once generated by the enrichment system.
            </p>
            <Button onClick={fetchDossiers}>
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const leagueDossiers = dossiers.dossiers.filter(d => d.type === 'dossier');
  const summaryDossier = dossiers.dossiers.find(d => d.type === 'summary');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">League Intelligence Dossiers</h1>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/entity-browser'}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Back to Entities
              </Button>
              <Badge variant="secondary">
                {dossiers.totalFiles} Dossiers
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dossiers.lastUpdated ? formatDate(dossiers.lastUpdated) : 'Unknown'}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            Strategic intelligence analysis for major sports leagues and competitions generated by Instance 3
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="commercial" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Commercial
            </TabsTrigger>
            <TabsTrigger value="digital" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Digital
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Card */}
            {summaryDossier && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Instance 3 Execution Summary
                  </CardTitle>
                  <CardDescription>
                    Complete analysis of the League & Competition Intelligence processing run
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Generated on {formatDate(summaryDossier.lastModified)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDossierContent(summaryDossier.name)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Summary
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dossiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagueDossiers.map((dossier) => {
                const score = getOpportunityScore(dossier.name);
                return (
                  <Card key={dossier.name} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getDossierIcon(dossier.name)}</span>
                          <div>
                            <CardTitle className="text-lg">{dossier.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
                            <CardDescription>
                              League Intelligence Dossier
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`${getPriorityColor(score)} text-white`}>
                            {score}/100
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(dossier.size)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedDossier === dossier.name ? (
                          <div className="space-y-3">
                            <div className="max-h-96 overflow-y-auto border rounded-md p-3 bg-gray-50">
                              <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700">
                                {dossierContent}
                              </pre>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDossier(null)}
                              >
                                Close
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const blob = new Blob([dossierContent], { type: 'text/markdown' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${dossier.filename}`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600">
                              Last updated: {formatDate(dossier.lastModified)}
                            </p>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => window.location.href = `/dossiers/leagues/${dossier.name}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Full Dossier
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Commercial Intelligence Tab */}
          <TabsContent value="commercial" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leagueDossiers.map((dossier) => {
                const score = getOpportunityScore(dossier.name);
                return (
                  <Card key={`commercial-${dossier.name}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        {dossier.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                      <CardDescription>Commercial Intelligence & Opportunity Analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Opportunity Score</span>
                          <Badge className={getPriorityColorClass(score)}>
                            {score}/100
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Commercial Value</span>
                            <span className="font-medium">
                              {dossier.name.toLowerCase().includes('premier') && '£12.25B'}
                              {dossier.name.toLowerCase().includes('champions') && '€3.5B'}
                              {dossier.name.toLowerCase().includes('indian') && '$10B'}
                              {dossier.name.toLowerCase().includes('australian') && '£100K-£500K'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Partnership Tier</span>
                            <span className="font-medium">
                              {score >= 90 ? 'Premium' : score >= 80 ? 'Strong' : 'Developing'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Engagement Priority</span>
                            <span className="font-medium">
                              {score >= 90 ? 'Critical' : score >= 80 ? 'High' : 'Medium'}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.location.href = `/dossiers/leagues/${dossier.name}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Commercial Analysis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Digital Transformation Tab */}
          <TabsContent value="digital" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leagueDossiers.map((dossier) => {
                const digitalMaturity = 
                  dossier.name.toLowerCase().includes('indian') ? 90 :
                  dossier.name.toLowerCase().includes('champions') ? 88 :
                  dossier.name.toLowerCase().includes('premier') ? 85 :
                  dossier.name.toLowerCase().includes('australian') ? 85 : 0;
                
                return (
                  <Card key={`digital-${dossier.name}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        {dossier.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                      <CardDescription>Digital Transformation & Innovation Assessment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="font-medium">Digital Maturity</span>
                            <span className="font-bold">{digitalMaturity}/100</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${digitalMaturity}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Streaming Capability</span>
                            <span className="font-medium">Advanced</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fan Engagement</span>
                            <span className="font-medium">High</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Data Analytics</span>
                            <span className="font-medium">Mature</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Social Integration</span>
                            <span className="font-medium">Excellent</span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.location.href = `/dossiers/leagues/${dossier.name}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Digital Analysis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leagueDossiers.map((dossier) => {
                const score = getOpportunityScore(dossier.name);
                return (
                  <Card key={`opp-${dossier.name}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-orange-600" />
                        {dossier.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                      <CardDescription>Yellow Panther Partnership Opportunities</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg border ${
                          score >= 90 ? 'bg-red-50 border-red-200' : 
                          score >= 80 ? 'bg-orange-50 border-orange-200' : 
                          'bg-yellow-50 border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Trophy className="h-5 w-5" />
                            <span className="font-semibold">Opportunity Assessment</span>
                          </div>
                          <p className="text-sm">
                            {score >= 90 ? 'Critical priority with exceptional partnership potential and commercial value.' :
                             score >= 80 ? 'Strong opportunity with proven digital innovation and international growth potential.' :
                             'Developing opportunity with analytics focus and international expansion capabilities.'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Key Opportunity Areas:</div>
                          <div className="text-sm space-y-1">
                            {dossier.name.toLowerCase().includes('premier') && (
                              <>
                                <div>• Commercial excellence optimization</div>
                                <div>• Global audience expansion platforms</div>
                                <div>• Club ecosystem technology solutions</div>
                              </>
                            )}
                            {dossier.name.toLowerCase().includes('champions') && (
                              <>
                                <div>• Premium positioning enhancement</div>
                                <div>• Sponsor relationship management</div>
                                <div>• Global broadcast innovation</div>
                              </>
                            )}
                            {dossier.name.toLowerCase().includes('indian') && (
                              <>
                                <div>• Digital innovation benchmarking</div>
                                <div>• Global scalability solutions</div>
                                <div>• Franchise technology platforms</div>
                              </>
                            )}
                            {dossier.name.toLowerCase().includes('australian') && (
                              <>
                                <div>• International expansion support</div>
                                <div>• Analytics platform enhancement</div>
                                <div>• Streaming innovation projects</div>
                              </>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.location.href = `/dossiers/leagues/${dossier.name}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Opportunity Analysis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Instance 3 Processing Details
                </CardTitle>
                <CardDescription>
                  Complete execution summary and performance metrics for the League & Competition Intelligence analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">4</div>
                    <div className="text-sm text-gray-600">Leagues Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">100%</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">90%</div>
                    <div className="text-sm text-gray-600">Data Quality Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">10</div>
                    <div className="text-sm text-gray-600">Minutes Duration</div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Processing Efficiency</div>
                      <div className="text-sm text-gray-600">40% ahead of schedule</div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Excellent</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Intelligence Value</div>
                      <div className="text-sm text-gray-600">High-value commercial insights</div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Strategic</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Actionability</div>
                      <div className="text-sm text-gray-600">Clear engagement pathways</div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Operational</Badge>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => summaryDossier && fetchDossierContent(summaryDossier.name)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Full Execution Summary
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}