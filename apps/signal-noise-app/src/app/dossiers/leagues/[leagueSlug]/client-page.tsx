'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Globe,
  MapPin,
  Calendar,
  Building,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Award,
  ExternalLink,
  Phone,
  Mail,
  Clock,
  Star,
  CheckCircle,
  AlertTriangle,
  Info,
  Trophy,
  Flag,
  Heart,
  Smartphone,
  Lightbulb,
  BarChart3,
  Zap,
  Crown,
  Database,
  Search,
  Download,
  Eye,
  FileText
} from 'lucide-react';

interface DossierContent {
  name: string;
  content: string;
  type: 'markdown';
  lastModified: string;
}

export default function LeagueDossierClient({ leagueSlug }: { leagueSlug: string }) {
  const params = useParams();
  const router = useRouter();
  const actualLeagueSlug = params.leagueSlug as string || leagueSlug;
  
  const [dossierContent, setDossierContent] = useState<DossierContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (actualLeagueSlug) {
      fetchDossierContent(actualLeagueSlug);
    }
  }, [actualLeagueSlug]);

  const fetchDossierContent = async (slug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dossiers/leagues?dossier=${encodeURIComponent(slug)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('League dossier not found');
        } else {
          throw new Error(`Failed to fetch dossier: ${response.status}`);
        }
        return;
      }
      
      const data = await response.json();
      setDossierContent(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dossier content');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced markdown parsing with better content extraction
  const parseDossierContent = (content: string) => {
    const parsed: Record<string, any> = {};

    // Extract basic info with better patterns
    const entityMatch = content.match(/\*\*Entity:\*\* (.+)/i);
    if (entityMatch) parsed.entity = entityMatch[1].trim();

    const typeMatch = content.match(/\*\*Type:\*\* (.+)/i);
    if (typeMatch) parsed.type = typeMatch[1].trim();

    const confidenceMatch = content.match(/\*\*Confidence Score:\*\* (.+)/i);
    if (confidenceMatch) parsed.confidence = confidenceMatch[1].trim();

    const opportunityMatch = content.match(/\*\*Opportunity Score:\*\* (.+)/i);
    if (opportunityMatch) parsed.opportunity = opportunityMatch[1].trim();

    // Enhanced section extraction with precise boundary detection
    const extractSectionExact = (sectionTitle: string, endBoundary?: string) => {
      let boundary = endBoundary || '(?=\n## |\n---|$)';
      const regex = new RegExp(`## ${sectionTitle}\s*\n([\s\S]*?)${boundary}`);
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    // Extract sections with exact boundaries based on actual document structure
    parsed.executiveSummary = extractSectionExact('Executive Summary', '(?=\n## Core Intelligence|\n---|$)');
    parsed.coreIntelligence = extractSectionExact('Core Intelligence', '(?=\n## Strategic Analysis|\n---|$)');
    parsed.strategicAnalysis = extractSectionExact('Strategic Analysis', '(?=\n## Yellow Panther Assessment|\n---|$)');
    parsed.yellowPantherAssessment = extractSectionExact('Yellow Panther Assessment', '(?=\n## Yellow Panther Opportunity Analysis|\n---|$)');
    parsed.commercialIntelligence = extractSectionExact('Commercial Intelligence', '(?=\n## Yellow Panther Opportunity Analysis|\n---|$)');
    parsed.opportunityAnalysis = extractSectionExact('Yellow Panther Opportunity Analysis', '(?=\n## Sources & Methodology|\n---|$)');
    
    // Fallback extraction if exact boundaries don't work
    if (!parsed.coreIntelligence) {
      parsed.coreIntelligence = extractSectionExact('Core Intelligence');
    }
    if (!parsed.strategicAnalysis) {
      parsed.strategicAnalysis = extractSectionExact('Strategic Analysis');
    }
    if (!parsed.yellowPantherAssessment) {
      parsed.yellowPantherAssessment = extractSectionExact('Yellow Panther Assessment');
    }
    if (!parsed.commercialIntelligence) {
      parsed.commercialIntelligence = extractSectionExact('Commercial Intelligence');
    }
    if (!parsed.opportunityAnalysis) {
      parsed.opportunityAnalysis = extractSectionExact('Yellow Panther Opportunity Analysis');
    }

    // Extract key findings if available
    const keyFindingsMatch = content.match(/### Key Findings\n([\s\S]*?)(?=\n### |\n---|$)/);
    if (keyFindingsMatch) {
      parsed.keyFindings = keyFindingsMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^[-*]\s*/, '').trim());
    }

    // Extract recommended approach if available
    const recommendedMatch = content.match(/### Recommended Approach\n([\s\S]*?)(?=\n---|$)/);
    if (recommendedMatch) parsed.recommendedApproach = recommendedMatch[1].trim();

    return parsed;
  };

  // Format markdown content for better display
  const formatMarkdownContent = (content: string) => {
    if (!content) return null;
    
    return content
      .split('\n\n')
      .filter(paragraph => paragraph.trim())
      .map((paragraph, index) => {
        // Handle bullet points
        if (paragraph.trim().startsWith('-')) {
          const items = paragraph.split('\n').filter(item => item.trim().startsWith('-'));
          return (
            <ul key={index} className="list-disc list-inside space-y-1 ml-4">
              {items.map((item, itemIndex) => (
                <li key={itemIndex} className="text-fm-off-white leading-relaxed">
                  {item.replace(/^[-*]\s*/, '')}
                </li>
              ))}
            </ul>
          );
        }
        
        // Handle headers
        if (paragraph.match(/^###/)) {
          return (
            <h3 key={index} className="text-lg font-semibold text-fm-white mt-4 mb-2">
              {paragraph.replace(/^###\s*/, '')}
            </h3>
          );
        }
        
        // Handle bold text
        if (paragraph.includes('**')) {
          const parts = paragraph.split(/\*\*/);
          return (
            <p key={index} className="text-fm-off-white leading-relaxed mb-3">
              {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i} className="text-fm-white font-semibold">{part}</strong> : part
              )}
            </p>
          );
        }
        
        // Regular paragraph
        return (
          <p key={index} className="text-fm-off-white leading-relaxed mb-3">
            {paragraph}
          </p>
        );
      });
  };

  const parsedContent = dossierContent ? parseDossierContent(dossierContent.content) : {};
  
  // Debug: Log parsed content to verify extraction
  useEffect(() => {
    if (parsedContent && Object.keys(parsedContent).length > 0) {
      console.log('Parsed Content Sections:', {
        coreIntelligence: parsedContent.coreIntelligence ? 'Found' : 'Missing',
        strategicAnalysis: parsedContent.strategicAnalysis ? 'Found' : 'Missing',
        yellowPantherAssessment: parsedContent.yellowPantherAssessment ? 'Found' : 'Missing',
        opportunityAnalysis: parsedContent.opportunityAnalysis ? 'Found' : 'Missing',
        commercialIntelligence: parsedContent.commercialIntelligence ? 'Found' : 'Missing'
      });
    }
  }, [parsedContent]);

  const getLeagueIcon = (slug: string) => {
    if (slug.toLowerCase().includes('premier')) return '⚪';
    if (slug.toLowerCase().includes('champions')) return '🏆';
    if (slug.toLowerCase().includes('indian')) return '🏏';
    if (slug.toLowerCase().includes('australian')) return '🏉';
    return '📋';
  };

  const getOpportunityScore = (slug: string): number => {
    if (slug.toLowerCase().includes('premier')) return 95;
    if (slug.toLowerCase().includes('champions')) return 93;
    if (slug.toLowerCase().includes('indian')) return 91;
    if (slug.toLowerCase().includes('australian')) return 86;
    return 0;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 90) return 'bg-red-500';
    if (score >= 80) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getPriorityColorClass = (score: number) => {
    if (score >= 90) return 'bg-fm-red/20 text-fm-red border-fm-red/40';
    if (score >= 80) return 'bg-fm-orange/20 text-fm-orange border-fm-orange/40';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
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

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-primary animate-spin" />
                <h1 className="text-3xl font-bold">Loading League Dossier</h1>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-medium-grey mx-auto mb-4"></div>
              <p className="text-fm-medium-grey">Loading league intelligence dossier...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error || !dossierContent) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">League Dossier Not Found</h1>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-fm-red mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Dossier Not Found</h2>
                <p className="text-fm-medium-grey mb-4">{error || 'The requested league dossier could not be found.'}</p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                  </Button>
                  <Button onClick={() => router.push('/dossiers/leagues')}>
                    View All Dossiers
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const score = getOpportunityScore(actualLeagueSlug);
  const leagueName = parsedContent.entity || actualLeagueSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dossiers/leagues')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dossiers
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getLeagueIcon(actualLeagueSlug)}</span>
              <h1 className="text-3xl font-bold">{leagueName}</h1>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <Badge className={`${getPriorityColor(score)} text-white`}>
                {score}/100
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(dossierContent.lastModified)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([dossierContent.content], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${actualLeagueSlug}-dossier.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Strategic intelligence analysis and partnership opportunities for {leagueName}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-header-bg">
        <div className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            {/* Responsive Tab Navigation */}
            <div className="bg-custom-box rounded-lg p-1">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-1 bg-transparent h-auto p-0">
                <TabsTrigger 
                  value="overview" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden md:inline">Overview</span>
                  <span className="md:hidden">O</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="core" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <Building className="h-4 w-4" />
                  <span className="hidden md:inline">Core Intel</span>
                  <span className="md:hidden">Core</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="strategic" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <Target className="h-4 w-4" />
                  <span className="hidden md:inline">Strategic</span>
                  <span className="md:hidden">S</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="commercial" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden md:inline">Commercial</span>
                  <span className="md:hidden">C</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="opportunities" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <Star className="h-4 w-4" />
                  <span className="hidden md:inline">Opportunities</span>
                  <span className="md:hidden">Opp</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="full-dossier" 
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-2 text-xs md:text-sm text-fm-medium-grey data-[state=active]:bg-fm-green data-[state=active]:text-custom-bg rounded-md transition-all duration-200"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden md:inline">Full Dossier</span>
                  <span className="md:hidden">Full</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-fm-yellow/20 to-fm-orange/20 border border-fm-yellow/30 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-fm-yellow/20 rounded-lg">
                          <BarChart3 className="h-6 w-6 text-fm-yellow" />
                        </div>
                        <span className="text-fm-yellow text-sm font-medium">Confidence</span>
                      </div>
                      <div className="text-3xl font-bold text-fm-white mb-2">{parsedContent.confidence || 'N/A'}</div>
                      <p className="text-fm-meta text-sm">Analysis Confidence Score</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-fm-green/20 to-fm-green/40 border border-fm-green/30 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-fm-green/20 rounded-lg">
                          <Star className="h-6 w-6 text-fm-green" />
                        </div>
                        <span className="text-fm-green text-sm font-medium">Opportunity</span>
                      </div>
                      <div className="text-3xl font-bold text-fm-white mb-2">{score}/100</div>
                      <p className="text-fm-meta text-sm">Partnership Potential</p>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <Card className="bg-custom-box border-custom-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl text-fm-white">
                        <div className="p-2 bg-fm-yellow/20 rounded-lg">
                          <Lightbulb className="h-5 w-5 text-fm-yellow" />
                        </div>
                        Executive Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {parsedContent.keyFindings && parsedContent.keyFindings.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-fm-white mb-4 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-fm-green" />
                            Key Findings
                          </h4>
                          <div className="space-y-3">
                            {parsedContent.keyFindings.map((finding: string, index: number) => (
                              <div key={index} className="flex gap-3">
                                <div className="w-2 h-2 bg-fm-green rounded-full mt-2 flex-shrink-0"></div>
                                <p className="text-fm-light-grey leading-relaxed">{finding}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {parsedContent.recommendedApproach && (
                        <div className="bg-fm-yellow/10 border border-fm-yellow/30 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-fm-white mb-3 flex items-center gap-2">
                            <Target className="h-5 w-5 text-fm-yellow" />
                            Recommended Approach
                          </h4>
                          <p className="text-fm-light-grey leading-relaxed">{parsedContent.recommendedApproach}</p>
                        </div>
                      )}
                      
                      {parsedContent.executiveSummary && (
                        <div className="text-fm-light-grey leading-relaxed space-y-4">
                          {formatMarkdownContent(parsedContent.executiveSummary)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  <Card className="bg-custom-box border-custom-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-lg text-fm-white">
                        <div className="p-2 bg-fm-orange/20 rounded-lg">
                          <Award className="h-5 w-5 text-fm-orange" />
                        </div>
                        Priority Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-fm-light-grey font-medium">Priority Score</span>
                          <span className="text-2xl font-bold text-fm-white">{score}/100</span>
                        </div>
                        <div className="w-full bg-custom-border rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${
                              score >= 90 ? 'bg-fm-red' : score >= 80 ? 'bg-fm-orange' : 'bg-fm-yellow'
                            }`} 
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg border ${
                        score >= 90 
                          ? 'bg-fm-red/20 border-fm-red/40' 
                          : score >= 80 
                          ? 'bg-fm-orange/20 border-fm-orange/40' 
                          : 'bg-fm-yellow/20 border-fm-yellow/40'
                      }`}>
                        <div className="text-fm-white font-semibold mb-2">
                          {score >= 90 ? '🔥 Critical Priority' : score >= 80 ? '⚡ High Priority' : '📈 Medium Priority'}
                        </div>
                        <div className="text-fm-light-grey text-sm leading-relaxed">
                          {score >= 90 ? 'Exceptional partnership potential with immediate value' :
                           score >= 80 ? 'Strong opportunity for significant growth and partnership' :
                           'Developing opportunity with solid potential for collaboration'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-custom-box border-custom-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-lg text-fm-white">
                        <div className="p-2 bg-fm-green/20 rounded-lg">
                          <Zap className="h-5 w-5 text-fm-green" />
                        </div>
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button className="w-full bg-fm-green hover:bg-fm-green/90 text-custom-bg font-medium py-3">
                        <Mail className="h-4 w-4 mr-2" />
                        Contact League
                      </Button>
                      <Button variant="outline" className="w-full border-custom-border text-fm-light-grey hover:bg-custom-bg font-medium py-3">
                        <Download className="h-4 w-4 mr-2" />
                        Export Dossier
                      </Button>
                      <Button variant="outline" className="w-full border-custom-border text-fm-light-grey hover:bg-custom-bg font-medium py-3">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Website
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Core Intelligence Tab */}
            <TabsContent value="core" className="space-y-8">
              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl text-fm-white">
                    <div className="p-2 bg-fm-green/20 rounded-lg">
                      <Building className="h-5 w-5 text-fm-green" />
                    </div>
                    Core Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsedContent.coreIntelligence ? (
                    <div className="text-fm-off-white leading-relaxed space-y-4">
                      {formatMarkdownContent(parsedContent.coreIntelligence)}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-custom-bg rounded-lg border border-custom-border">
                      <Building className="h-12 w-12 text-fm-medium-grey mx-auto mb-4" />
                      <p className="text-fm-meta mb-2">Core intelligence section not found</p>
                      <p className="text-fm-meta-subtle text-sm">This section may not be available in the current dossier</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Strategic Analysis Tab */}
            <TabsContent value="strategic" className="space-y-8">
              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-fm-orange/20 rounded-lg">
                      <Target className="h-5 w-5 text-fm-orange" />
                    </div>
                    Strategic Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsedContent.strategicAnalysis ? (
                    <div className="text-fm-off-white leading-relaxed space-y-4">
                      {formatMarkdownContent(parsedContent.strategicAnalysis)}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-custom-bg rounded-lg border-custom-border">
                      <Target className="h-12 w-12 text-fm-medium-grey mx-auto mb-4" />
                      <p className="text-fm-medium-grey mb-2">Strategic analysis section not found</p>
                      <p className="text-fm-meta text-sm">This section may not be available in the current dossier</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Commercial Intelligence Tab */}
            <TabsContent value="commercial" className="space-y-8">
              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-fm-green/20 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-fm-green" />
                    </div>
                    Commercial Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsedContent.commercialIntelligence ? (
                    <div className="text-fm-off-white leading-relaxed space-y-4">
                      {formatMarkdownContent(parsedContent.commercialIntelligence)}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-custom-bg rounded-lg border-custom-border">
                      <DollarSign className="h-12 w-12 text-fm-medium-grey mx-auto mb-4" />
                      <p className="text-fm-medium-grey mb-2">Commercial intelligence section not found</p>
                      <p className="text-fm-meta text-sm">This section may not be available in the current dossier</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Opportunities Tab */}
            <TabsContent value="opportunities" className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <Card className="bg-custom-box border-custom-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 bg-fm-yellow/20 rounded-lg">
                        <Star className="h-5 w-5 text-fm-yellow" />
                      </div>
                      Yellow Panther Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {parsedContent.yellowPantherAssessment ? (
                      <div className="text-fm-off-white leading-relaxed space-y-4">
                        {formatMarkdownContent(parsedContent.yellowPantherAssessment)}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-custom-bg rounded-lg border-custom-border">
                        <Star className="h-12 w-12 text-fm-medium-grey mx-auto mb-4" />
                        <p className="text-fm-medium-grey mb-2">Yellow Panther assessment section not found</p>
                        <p className="text-fm-meta text-sm">This section may not be available in the current dossier</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-custom-box border-custom-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 bg-fm-orange/20 rounded-lg">
                        <Crown className="h-5 w-5 text-fm-orange" />
                      </div>
                      Opportunity Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {parsedContent.opportunityAnalysis ? (
                      <div className="text-fm-off-white leading-relaxed space-y-4">
                        {formatMarkdownContent(parsedContent.opportunityAnalysis)}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-custom-bg rounded-lg border-custom-border">
                        <Crown className="h-12 w-12 text-fm-medium-grey mx-auto mb-4" />
                        <p className="text-fm-medium-grey mb-2">Opportunity analysis section not found</p>
                        <p className="text-fm-meta text-sm">This section may not be available in the current dossier</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Full Dossier Tab */}
            <TabsContent value="full-dossier" className="space-y-8">
              <Card className="bg-custom-box border-custom-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-fm-meta/20 rounded-lg">
                      <FileText className="h-5 w-5 text-fm-off-white" />
                    </div>
                    Complete Intelligence Dossier
                  </CardTitle>
                  <p className="text-fm-medium-grey">
                    Full markdown dossier with complete strategic analysis and recommendations
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="max-h-[700px] overflow-y-auto border border-custom-border rounded-xl p-6 bg-custom-bg">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-fm-off-white leading-relaxed">
                      {dossierContent.content}
                    </pre>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      className="bg-fm-green hover:bg-fm-green/90 text-custom-bg font-medium py-3"
                      onClick={() => {
                        const blob = new Blob([dossierContent.content], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${actualLeagueSlug}-dossier.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Full Dossier
                    </Button>
                    <Button
                      variant="outline"
                      className="border-custom-border text-fm-off-white hover:bg-custom-bg font-medium py-3"
                      onClick={() => {
                        navigator.clipboard.writeText(dossierContent.content);
                      }}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}