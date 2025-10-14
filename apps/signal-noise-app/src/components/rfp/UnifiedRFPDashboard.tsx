/**
 * Unified RFP Dashboard with Connection Intelligence
 * 
 * Displays RFP opportunities alongside LinkedIn connection analysis
 * Shows optimal introduction paths and network-based opportunity enhancement
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedScoringAlgorithm, EnhancedScoringResult } from '@/lib/enhanced-scoring-algorithm';

interface RFPOpportunity {
  id: string;
  organization: string;
  title: string;
  description: string;
  estimated_value: string;
  deadline?: string;
  requirements: string[];
  yellow_panther_fit: number;
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  urgency_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detected_at: string;
  source: string;
  connection_intelligence?: ConnectionIntelligence;
}

interface ConnectionIntelligence {
  request_id: string;
  analysis_timestamp: string;
  processing_time_ms: number;
  target_organization: string;
  
  yellow_panther_team_analysis: {
    stuart_cope_connections: number;
    total_team_connections: number;
    strong_paths: number;
    medium_paths: number;
    primary_path_available: boolean;
  };
  
  optimal_introduction_paths: Array<{
    yellow_panther_contact: string;
    connection_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    confidence_score: number;
    path_description: string;
    mutual_connections?: Array<{
      name: string;
      linkedin_url: string;
      relationship_context: string;
      years_known: number;
    }>;
    messaging_strategy: string;
    timeline_to_introduction: string;
  }>;
  
  opportunity_enhancement: {
    base_score: number;
    network_boost: number;
    final_score: number;
    success_probability: number;
    competitive_advantage: string;
  };
  
  actionable_next_steps: Array<{
    action: string;
    priority: 'IMMEDIATE' | 'WITHIN_24H' | 'WITHIN_48H';
    contact_person?: string;
    talking_points: string[];
  }>;
}

const UnifiedRFPDashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<RFPOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<RFPOpportunity | null>(null);
  const [enhancedScores, setEnhancedScores] = useState<Map<string, EnhancedScoringResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('opportunities');

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rfp-intelligence/opportunities');
      const data = await response.json();
      
      setOpportunities(data.opportunities || []);
      
      // Calculate enhanced scores for all opportunities
      const scores = new Map<string, EnhancedScoringResult>();
      data.opportunities.forEach((opp: RFPOpportunity) => {
        const enhancedScore = EnhancedScoringAlgorithm.calculateEnhancedScore(
          {
            organization: opp.organization,
            base_score: opp.yellow_panther_fit,
            estimated_value: opp.estimated_value,
            deadline: opp.deadline ? new Date(opp.deadline) : undefined,
            requirements: opp.requirements,
            yellow_panther_fit: opp.yellow_panther_fit,
            competition_level: opp.competition_level,
            urgency_level: opp.urgency_level
          },
          opp.connection_intelligence
        );
        scores.set(opp.id, enhancedScore);
      });
      
      setEnhancedScores(scores);
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getConnectionStrengthColor = (strength: string) => {
    switch (strength) {
      case 'STRONG': return 'bg-green-500 text-white';
      case 'MEDIUM': return 'bg-blue-500 text-white';
      case 'WEAK': return 'bg-gray-400 text-white';
      default: return 'bg-gray-300 text-black';
    }
  };

  const formatTimeline = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const OpportunityCard: React.FC<{ opportunity: RFPOpportunity; enhancedScore: EnhancedScoringResult }> = ({ 
    opportunity, 
    enhancedScore 
  }) => (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
        selectedOpportunity?.id === opportunity.id ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => setSelectedOpportunity(opportunity)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-gray-900">
              {opportunity.organization}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {opportunity.title}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getPriorityColor(enhancedScore.priority_ranking)}>
              {enhancedScore.priority_ranking}
            </Badge>
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">
                {enhancedScore.final_score}
              </div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Value:</span>
          <span className="text-sm font-bold text-green-600">{opportunity.estimated_value}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Success Probability:</span>
          <span className="text-sm font-bold text-blue-600">{enhancedScore.success_probability}%</span>
        </div>
        
        {opportunity.connection_intelligence && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Network Access:</span>
              <div className="flex gap-2">
                {opportunity.connection_intelligence.yellow_panther_team_analysis.stuart_cope_connections > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Stuart Cope: {opportunity.connection_intelligence.yellow_panther_team_analysis.stuart_cope_connections}
                  </Badge>
                )}
                {opportunity.connection_intelligence.yellow_panther_team_analysis.total_team_connections > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Total: {opportunity.connection_intelligence.yellow_panther_team_analysis.total_team_connections}
                  </Badge>
                )}
              </div>
            </div>
            
            {opportunity.connection_intelligence.opportunity_enhancement.network_boost > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Network Boost:</span>
                <Badge className="bg-purple-500 text-white text-xs">
                  +{opportunity.connection_intelligence.opportunity_enhancement.network_boost} points
                </Badge>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Detected: {formatTimeline(opportunity.detected_at)}</span>
          <span>Source: {opportunity.source}</span>
        </div>
      </CardContent>
    </Card>
  );

  const ConnectionPathsPanel: React.FC<{ connectionIntelligence?: ConnectionIntelligence }> = ({ 
    connectionIntelligence 
  }) => {
    if (!connectionIntelligence) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No connection intelligence available</p>
          <p className="text-sm mt-2">Connection analysis will be performed for high-fit opportunities</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {connectionIntelligence.yellow_panther_team_analysis.stuart_cope_connections}
            </div>
            <div className="text-xs text-gray-600">Stuart Cope</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {connectionIntelligence.yellow_panther_team_analysis.strong_paths}
            </div>
            <div className="text-xs text-gray-600">Strong Paths</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {connectionIntelligence.yellow_panther_team_analysis.total_team_connections}
            </div>
            <div className="text-xs text-gray-600">Total Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {connectionIntelligence.opportunity_enhancement.success_probability}%
            </div>
            <div className="text-xs text-gray-600">Success Rate</div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900">Optimal Introduction Paths</h4>
          {connectionIntelligence.optimal_introduction_paths.map((path, index) => (
            <Card key={index} className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h5 className="font-semibold text-blue-900">{path.yellow_panther_contact}</h5>
                    <Badge className={getConnectionStrengthColor(path.connection_strength)}>
                      {path.connection_strength}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{path.confidence_score}%</div>
                    <div className="text-xs text-gray-600">Confidence</div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">{path.path_description}</p>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-600 font-medium">{path.timeline_to_introduction}</span>
                  <span className="text-gray-500">Processing: {Math.round(connectionIntelligence.processing_time_ms / 1000)}s</span>
                </div>
                
                {path.mutual_connections && path.mutual_connections.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Mutual Connections:</p>
                    <div className="space-y-1">
                      {path.mutual_connections.map((contact, idx) => (
                        <div key={idx} className="text-xs text-gray-700">
                          <span className="font-medium">{contact.name}</span> - {contact.relationship_context}
                          <span className="text-gray-500 ml-2">({contact.years_known} years)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {path.messaging_strategy && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Messaging Strategy:</p>
                    <p className="text-xs text-gray-700">{path.messaging_strategy}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900">Recommended Next Steps</h4>
          {connectionIntelligence.actionable_next_steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <Badge variant={step.priority === 'IMMEDIATE' ? 'destructive' : 'outline'}>
                {step.priority}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{step.action}</p>
                {step.contact_person && (
                  <p className="text-xs text-gray-600">Contact: {step.contact_person}</p>
                )}
                {step.talking_points.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-700">Key Points:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {step.talking_points.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const NetworkBoostBreakdown: React.FC<{ enhancedScore: EnhancedScoringResult }> = ({ enhancedScore }) => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Network Boost Breakdown</h4>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm">Original Score</span>
          <span className="font-bold">{enhancedScore.original_score}</span>
        </div>
        
        {enhancedScore.network_boost_breakdown.stuart_cope_bonus > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-600">Stuart Cope Connection Bonus</span>
            <span className="font-bold text-green-600">+{enhancedScore.network_boost_breakdown.stuart_cope_bonus}</span>
          </div>
        )}
        
        {enhancedScore.network_boost_breakdown.connection_strength_bonus > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-600">Connection Strength Bonus</span>
            <span className="font-bold text-blue-600">+{enhancedScore.network_boost_breakdown.connection_strength_bonus}</span>
          </div>
        )}
        
        {enhancedScore.network_boost_breakdown.path_diversity_bonus > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-purple-600">Path Diversity Bonus</span>
            <span className="font-bold text-purple-600">+{enhancedScore.network_boost_breakdown.path_diversity_bonus}</span>
          </div>
        )}
        
        {enhancedScore.network_boost_breakdown.urgency_multiplier > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-orange-600">Urgency Multiplier</span>
            <span className="font-bold text-orange-600">+{enhancedScore.network_boost_breakdown.urgency_multiplier.toFixed(1)}</span>
          </div>
        )}
        
        {enhancedScore.network_boost_breakdown.strategic_value_bonus > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-indigo-600">Strategic Value Bonus</span>
            <span className="font-bold text-indigo-600">+{enhancedScore.network_boost_breakdown.strategic_value_bonus}</span>
          </div>
        )}
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold">Final Enhanced Score</span>
          <span className="text-lg font-bold text-green-600">{enhancedScore.final_score}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Success Probability</span>
          <span className="font-bold text-blue-600">{enhancedScore.success_probability}%</span>
        </div>
        <Progress value={enhancedScore.success_probability} className="h-2" />
      </div>
      
      <div className="space-y-2">
        <h5 className="font-semibold text-gray-900">Competitive Advantage</h5>
        <p className="text-sm text-gray-700">{enhancedScore.competitive_advantage}</p>
      </div>
      
      <div className="space-y-2">
        <h5 className="font-semibold text-gray-900">Recommended Approach</h5>
        <p className="text-sm text-gray-700">{enhancedScore.recommended_approach}</p>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Next Step Timeline</span>
        <span className="text-sm font-bold text-orange-600">{enhancedScore.next_step_timeline}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RFP opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Unified RFP Intelligence Dashboard</h1>
        <Button onClick={fetchOpportunities} variant="outline">
          Refresh Data
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities">Opportunities ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="selected">Selected Opportunity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid gap-4">
            {opportunities.map((opportunity) => {
              const enhancedScore = enhancedScores.get(opportunity.id);
              return enhancedScore ? (
                <OpportunityCard 
                  key={opportunity.id} 
                  opportunity={opportunity} 
                  enhancedScore={enhancedScore}
                />
              ) : null;
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="selected" className="space-y-4">
          {selectedOpportunity ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedOpportunity.organization}</CardTitle>
                    <p className="text-gray-600">{selectedOpportunity.title}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-sm text-gray-700">{selectedOpportunity.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Estimated Value</h4>
                        <p className="text-lg font-bold text-green-600">{selectedOpportunity.estimated_value}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Deadline</h4>
                        <p className="text-sm">
                          {selectedOpportunity.deadline ? new Date(selectedOpportunity.deadline).toLocaleDateString() : 'Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Requirements</h4>
                      <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                        {selectedOpportunity.requirements.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Competition Level</h4>
                        <Badge variant="outline">{selectedOpportunity.competition_level}</Badge>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Urgency Level</h4>
                        <Badge variant="outline">{selectedOpportunity.urgency_level}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-4">
                {selectedOpportunity.connection_intelligence && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Connection Intelligence</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ConnectionPathsPanel connectionIntelligence={selectedOpportunity.connection_intelligence} />
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Enhanced Scoring Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {enhancedScores.get(selectedOpportunity.id) && (
                          <NetworkBoostBreakdown enhancedScore={enhancedScores.get(selectedOpportunity.id)!} />
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Select an opportunity to view detailed analysis</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{opportunities.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">With Network Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {opportunities.filter(opp => opp.connection_intelligence?.yellow_panther_team_analysis.total_team_connections > 0).length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Critical Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {Array.from(enhancedScores.values()).filter(score => score.priority_ranking === 'CRITICAL').length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedRFPDashboard;