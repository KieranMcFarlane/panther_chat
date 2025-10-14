/**
 * Entity Dossier Component
 * Displays comprehensive intelligence dossiers for entities with opportunity scoring
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { 
  Users, 
  TrendingUp, 
  Mail, 
  Calendar, 
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  User,
  Building,
  Globe,
  ExternalLink
} from 'lucide-react';

interface PersonOfInterest {
  id: string;
  name: string;
  role: string;
  source: string;
  profileUrl?: string;
  emailGuess?: string;
  emailConfidence?: number;
  connectionPath?: string;
  connectionStrength?: number;
  notes?: string;
}

interface ConnectionPath {
  path: string;
  strength: number;
  teamMember: string;
}

interface Signal {
  type: string;
  details: string;
  date: string;
  severity: 'low' | 'medium' | 'high';
}

interface DossierData {
  entityName: string;
  entityIndustry?: string;
  entityUrl?: string;
  entityCountry?: string;
  summary: string;
  signals: Signal[];
  topPOIs: PersonOfInterest[];
  connectionPaths: ConnectionPath[];
  scores: {
    opportunityScore: number;
    connectionScore: number;
    finalScore: number;
  };
  recommendedActions: Array<{
    action: string;
    owner?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  rawEvidence: string[];
  outreachTemplate?: {
    subject: string;
    body: string;
  };
  lastUpdated: string;
  status: 'hot' | 'warm' | 'cold';
}

interface EntityDossierProps {
  entityId: string;
  entityData?: any;
  isLoading?: boolean;
  onRefresh?: () => void;
  onPinDossier?: () => void;
  isPinned?: boolean;
}

const EntityDossier: React.FC<EntityDossierProps> = ({
  entityId,
  entityData,
  isLoading = false,
  onRefresh,
  onPinDossier,
  isPinned = false
}) => {
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(isLoading);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (entityId) {
      fetchEntityDossier(entityId);
    }
  }, [entityId]);

  const fetchEntityDossier = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/entities/${id}/dossier`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dossier: ${response.statusText}`);
      }

      const data = await response.json();
      setDossier(data.dossier);
    } catch (err) {
      console.error('Error fetching entity dossier:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dossier');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-500';
      case 'warm': return 'bg-yellow-500';
      case 'cold': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-muted-foreground">Generating entity dossier...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-4 text-center">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-muted-foreground">Error loading dossier: {error}</p>
                <Button onClick={() => fetchEntityDossier(entityId)} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-4 text-center">
                <Building className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No dossier available for this entity</p>
                <Button onClick={() => fetchEntityDossier(entityId)} variant="outline">
                  Generate Dossier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Building className="h-6 w-6 text-muted-foreground" />
                <div>
                  <CardTitle className="text-2xl">{dossier.entityName}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="secondary">{dossier.entityIndustry || 'Unknown'}</Badge>
                    {dossier.entityCountry && (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Globe className="h-3 w-3" />
                        <span>{dossier.entityCountry}</span>
                      </Badge>
                    )}
                    <Badge className={`${getStatusColor(dossier.status)} text-white`}>
                      {dossier.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onPinDossier}
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Scores */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Opportunity Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(dossier.scores.opportunityScore)}`}>
                      {dossier.scores.opportunityScore}/100
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Connection Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(dossier.scores.connectionScore)}`}>
                      {dossier.scores.connectionScore}/100
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Final Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(dossier.scores.finalScore)}`}>
                      {dossier.scores.finalScore}/100
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-sm text-muted-foreground">{dossier.summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pois">People of Interest</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entity Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dossier.entityUrl && (
                <div className="flex items-center space-x-2">
                  <Link className="h-4 w-4" />
                  <a 
                    href={dossier.entityUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {dossier.entityUrl}
                  </a>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  Last updated: {new Date(dossier.lastUpdated).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {dossier.outreachTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Outreach Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Subject:</h4>
                    <p className="text-sm text-muted-foreground">{dossier.outreachTemplate.subject}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Body:</h4>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                      <pre className="whitespace-pre-wrap font-sans">
                        {dossier.outreachTemplate.body}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pois" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Persons of Interest</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dossier.topPOIs.map((poi, index) => (
                  <div key={poi.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <Link href={`/person/${poi.id}`} className="hover:text-blue-600 transition-colors">
                            <h3 className="font-semibold flex items-center gap-2">
                              {poi.name}
                              <ExternalLink className="h-3 w-3 text-blue-500" />
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground">{poi.role}</p>
                          
                          {poi.emailGuess && (
                            <div className="flex items-center space-x-2 mt-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{poi.emailGuess}</span>
                              {poi.emailConfidence && (
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(poi.emailConfidence * 100)}% confidence
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {poi.connectionPath && (
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Connection: {poi.connectionPath}
                              </Badge>
                            </div>
                          )}
                          
                          {poi.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{poi.notes}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge variant="outline">#{index + 1}</Badge>
                        {poi.profileUrl && (
                          <Button variant="ghost" size="sm" asChild className="mt-2">
                            <a href={poi.profileUrl} target="_blank" rel="noopener noreferrer">
                              <Link className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dossier.connectionPaths.map((path, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{path.path}</p>
                        <p className="text-sm text-muted-foreground">via {path.teamMember}</p>
                      </div>
                    </div>
                    <Badge variant={path.strength >= 7 ? 'default' : 'secondary'}>
                      Strength: {path.strength}/10
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Opportunity Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dossier.signals.map((signal, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg">
                    {getSeverityIcon(signal.severity)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{signal.type}</h4>
                        <Badge variant="outline">{signal.date}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{signal.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dossier.recommendedActions.map((action, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded" />
                      <div>
                        <p className="font-medium">{action.action}</p>
                        {action.owner && (
                          <p className="text-sm text-muted-foreground">Owner: {action.owner}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={
                      action.priority === 'high' ? 'destructive' :
                      action.priority === 'medium' ? 'default' : 'secondary'
                    }>
                      {action.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EntityDossier;