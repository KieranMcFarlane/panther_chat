/**
 * 🏆 Tenders Page
 * 
 * Live tender opportunities from our unified RFP analysis system
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Building2, 
  MapPin, 
  PoundSterling, 
  Calendar, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Eye,
  Target,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';

// Import RFP storage service for unified data access
import { rfpStorageService } from '@/services/RFPStorageService';
import { supabase } from '@/lib/supabase-client';
import { comprehensiveRfpOpportunities } from '@/lib/comprehensive-rfp-opportunities';
import digitalRfpOpportunities from '@/lib/digital-rfp-opportunities';

// Use digital-first opportunities for optimal Yellow Panther alignment
const alignedOpportunities = digitalRfpOpportunities;

export default function TendersPage() {
  const [opportunities, setOpportunities] = useState([]);
  const [detectedRFPs, setDetectedRFPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoadedAt, setDataLoadedAt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDetectedOnly, setShowDetectedOnly] = useState(false);
const [filterSource, setFilterSource] = useState('all');
  const [rfpStats, setRfpStats] = useState({ total: 0, recent: 0 });
  const [a2aRunning, setA2aRunning] = useState(false);
  const [a2aStatus, setA2aStatus] = useState(null);
  // Initialize stats with empty values - will be populated from unified data
  const [stats, setStats] = useState({
    total_opportunities: 0,
    total_value_millions: '0',
    urgent_deadlines: 0,
    average_fit_score: 0
  });

  // Function to calculate stats from opportunities array
  const calculateStatsFromOpportunities = (opps) => {
    const totalValueEstimate = opps.reduce((sum, opp) => {
      // Handle null or undefined values
      if (!opp.value) return sum;
      
      const match = opp.value.match(/£?([\d.]+)([KM])/);
      if (match) {
        const value = parseFloat(match[1]);
        const multiplier = match[2] === 'M' ? 1000 : (match[2] === 'K' ? 1 : 1);
        return sum + (value * multiplier);
      }
      return sum;
    }, 0);

    const urgentDeadlines = opps.filter(opp => {
      if (!opp.deadline) return false;
      const days = Math.ceil((new Date(opp.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days !== null && days <= 30 && days > 0;
    }).length;

    const avgFitScore = opps.length > 0 ? Math.round(opps.reduce((sum, opp) => sum + (opp.yellow_panther_fit || 0), 0) / opps.length) : 0;

    return {
      total_opportunities: opps.length,
      total_value_millions: totalValueEstimate > 1000 ? `${Math.round(totalValueEstimate/1000)}+` : `${Math.round(totalValueEstimate)}`,
      urgent_deadlines: urgentDeadlines,
      average_fit_score: avgFitScore
    };
  };

  // Load detected RFPs from unified table - DISABLED FOR TESTING
  // useEffect(() => {
  //   const loadDetectedRFPs = async () => {
  //     try {
  //       const rfps = await rfpStorageService.getRFPs({ 
  //         limit: 50,
  //         source: 'ai-detected', // Only AI-detected RFPs
  //         orderBy: 'detected_at',
  //         orderDirection: 'desc'
  //       });
  //       
  //       console.log(`🎯 Loaded ${rfps.length} AI-detected RFPs from unified table`);
  //       
  //       setDetectedRFPs(rfps);
  //       
  //       // Calculate RFP stats
  //       const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  //       const recentRFPs = rfps.filter(rfp => new Date(rfp.detected_at) > weekAgo);
  //       
  //       setRfpStats({
  //         total: rfps.length,
  //         recent: recentRFPs.length
  //       });
  //       
  //     } catch (error) {
  //       console.error('❌ Error loading AI-detected RFPs:', error);
  //       setDetectedRFPs([]);
  //       setRfpStats({ total: 0, recent: 0 });
  //     }
  //   };

  //   loadDetectedRFPs();
  //   
  //   // Check A2A system status on load
  //   checkA2AStatus();
  //   
  //   // Set up real-time subscription for new RFPs from rfp_opportunities table
  //   const subscription = supabase
  //     .channel('rfp-opportunities-changes')
  //     .on('postgres_changes', 
  //       { 
  //         event: 'INSERT', 
  //         schema: 'public', 
  //         table: 'rfp_opportunities'
  //       }, 
  //       (payload) => {
  //         console.log('🆕 New RFP opportunity:', payload.new);
  //         setDetectedRFPs(prev => [payload.new, ...prev].slice(0, 50));
  //         setRfpStats(prev => ({
  //           ...prev,
  //           total: prev.total + 1,
  //           recent: prev.recent + 1
  //         }));
  //       }
  //     )
  //     .subscribe();

  //   return () => {
  //     subscription.unsubscribe();
  //   };
  // }, []);

  // Check A2A system status
  const checkA2AStatus = async () => {
    try {
      const response = await fetch('/api/a2a-system/start');
      const data = await response.json();
      
      if (data.success) {
        setA2aStatus(data.status);
        setA2aRunning(data.apiStatus?.isCurrentlyRunning || false);
      }
    } catch (error) {
      console.error('Failed to check A2A status:', error);
    }
  };

  // Start A2A system
  const startA2A = async () => {
    if (a2aRunning) {
      console.log('A2A system is already running');
      return;
    }

    try {
      setA2aRunning(true);
      
      const response = await fetch('/api/a2a-system/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityLimit: 50,
          startImmediate: true,
          monitoringMode: 'discovery'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('🚀 A2A system started successfully');
        setA2aStatus('running');
        
        // Check status every 30 seconds
        const statusInterval = setInterval(async () => {
          const statusResponse = await fetch('/api/a2a-system/start');
          const statusData = await statusResponse.json();
          
          if (statusData.success) {
            setA2aStatus(statusData.status);
            
            // Stop checking when system is no longer running
            if (!statusData.apiStatus?.isCurrentlyRunning) {
              clearInterval(statusInterval);
              setA2aRunning(false);
              // Reload detected RFPs to get new opportunities
              window.location.reload();
            }
          }
        }, 30000);

        // Auto-stop checking after 10 minutes
        setTimeout(() => {
          clearInterval(statusInterval);
          setA2aRunning(false);
        }, 10 * 60 * 1000);

      } else {
        console.error('Failed to start A2A system:', result);
        setA2aRunning(false);
      }
    } catch (error) {
      console.error('Error starting A2A system:', error);
      setA2aRunning(false);
    }
  };

  // Load comprehensive RFP data from unified table
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Load opportunities from rfp_opportunities table via API
      console.log('🔄 Starting data load from API...');
      try {
        const response = await fetch('/api/tenders?action=opportunities&limit=100&t=' + Date.now() + '&v=' + Math.random());
        console.log('📡 API response received:', response.status);
        const data = await response.json();
        console.log('📡 API data parsed:', { opportunities: data.opportunities?.length, total: data.total, is_real_data: data.is_rfp_opportunities_data, filtering_stats: data.filtering_stats });
        
        if (data.opportunities && data.opportunities.length > 0) {
          setOpportunities(data.opportunities);
          setStats(calculateStatsFromOpportunities(data.opportunities));
          setDataLoadedAt(new Date());
          console.log(`✅ SUCCESS: Loaded ${data.opportunities.length} filtered opportunities (${data.filtering_stats?.filtered_out || 0} broken URLs removed)`);
          console.log('📊 Data source:', data.source);
          if (data.filtering_stats) {
            console.log(`📊 Quality filtering: ${data.filtering_stats.after_url_filtering}/${data.filtering_stats.total_retrieved} opportunities passed URL validation`);
          }
          console.log('📊 Sample real opportunity:', { title: data.opportunities[0].title, organization: data.opportunities[0].organization, value: data.opportunities[0].value, yellow_panther_fit: data.opportunities[0].yellow_panther_fit });
          
          // Debug: Check first few opportunities for source URLs
          console.log('🔍 DEBUG: First 5 opportunities source URL status:');
          data.opportunities.slice(0, 5).forEach((opp, index) => {
            console.log(`  ${index + 1}. ${opp.title.substring(0, 50)}... -> ${opp.source_url ? 'HAS SOURCE URL' : 'NO SOURCE URL'}`);
            if (opp.source_url) {
              console.log(`     URL: ${opp.source_url}`);
            }
          });
        } else {
          console.log('📊 API returned no filtered data, using digital-first opportunities optimized for Yellow Panther');
          
          // Use digital-first data as optimal fallback (aligned with Yellow Panther's agency expertise)
          const digitalData = alignedOpportunities.map(opp => ({
            ...opp,
            source_url: opp.url || null, // Map 'url' field to 'source_url' for consistency
            deadline: opp.deadline || null,
            posted_date: opp.posted || null,
            yellow_panther_fit: opp.yellow_panther_fit || 85,
            category: opp.category || 'Digital Transformation',
            status: opp.status || 'qualified'
          }));
          
          setOpportunities(digitalData);
          setStats(calculateStatsFromOpportunities(digitalData));
          setDataLoadedAt(new Date());
          
          console.log(`✅ SUCCESS: Using ${digitalData.length} digital-first opportunities optimized for agency services`);
          console.log('📊 Data source: "Yellow Panther Digital-First Opportunities (Optimized for Agency Services)"');
          
          // Debug: Check first few digital opportunities for source URLs
          console.log('🔍 DEBUG: First 5 digital opportunities source URL status:');
          digitalData.slice(0, 5).forEach((opp, index) => {
            console.log(`  ${index + 1}. ${opp.title.substring(0, 50)}... -> ${opp.source_url ? 'HAS SOURCE URL' : 'NO SOURCE URL'}`);
            if (opp.source_url) {
              console.log(`     URL: ${opp.source_url}`);
            }
          });
        }
      } catch (error) {
        console.error('❌ ERROR: Failed to load from API:', error);
        console.error('❌ Full error details:', error);
        // Show error state instead of fallback data
        setOpportunities([]);
        setStats(calculateStatsFromOpportunities([]));
      }
      
      setLoading(false);
    };
    
    console.log('🚀 Tenders useEffect running - about to load real data');
    loadData();
  }, []);

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Enhanced status filtering
    let matchesStatus = filterStatus === 'all';
    if (!matchesStatus) {
      const status = opp.status ? opp.status.toLowerCase() : '';
      const title = opp.title ? opp.title.toLowerCase() : '';
      const category = opp.category ? opp.category.toLowerCase() : '';
      
      if (filterStatus === 'active_rfp') {
        // ACTIVE_RFP: Real RFPs with procurement language, deadlines, and official sources
        const hasRfpKeywords = title.includes('rfp') || title.includes('tender') || title.includes('procurement') || 
                               title.includes('bid') || title.includes('contract') || title.includes('invitation');
        const hasDeadline = opp.deadline && new Date(opp.deadline) >= new Date();
        const hasValidSource = opp.source_url && !opp.source_url.includes('example.com');
        matchesStatus = hasRfpKeywords && hasDeadline && hasValidSource;
      } else if (filterStatus === 'signal') {
        // SIGNAL: Indicators, intelligence, market signals, and early opportunities
        const hasSignalKeywords = title.includes('partnership') || title.includes('opportunity') || 
                                title.includes('initiative') || title.includes('program') || title.includes('project') ||
                                title.includes('digital') || title.includes('transformation') || title.includes('strategy');
        const hasHighValue = opp.value && (opp.value.includes('M') || (opp.value.includes('K') && parseInt(opp.value) > 100));
        matchesStatus = hasSignalKeywords || hasHighValue;
      } else if (filterStatus === 'qualified') {
        matchesStatus = status.includes('qualified') || status.includes('active');
      } else if (filterStatus === 'expired') {
        matchesStatus = status.includes('expired') || (opp.deadline && new Date(opp.deadline) < new Date());
      } else if (filterStatus === 'active') {
        matchesStatus = status.includes('active') && (!opp.deadline || new Date(opp.deadline) >= new Date());
      } else if (filterStatus === 'emerging') {
        matchesStatus = status.includes('emerging') || status.includes('potential');
      } else {
        matchesStatus = status === filterStatus;
      }
    }
    
    return matchesSearch && matchesStatus;
  });

  console.log(`🔍 Filter results: ${filteredOpportunities.length} of ${opportunities.length} opportunities (filter: ${filterStatus}, search: "${searchTerm}")`);
  console.log('🔍 Debug: opportunities.length =', opportunities.length);

  // Filter detected RFPs
  const filteredDetectedRFPs = detectedRFPs.filter(rfp => {
    const matchesSearch = searchTerm === '' || 
      rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rfp.description && rfp.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesStatus = true;
    if (filterStatus !== 'all') {
      matchesStatus = rfp.status === filterStatus || rfp.priority === filterStatus;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Combine results based on source selection
  const displayOpportunities = filterSource === 'ai-detected' ? [] : filteredOpportunities;
  const displayRFPs = filterSource === 'ai-detected' ? filteredDetectedRFPs : [];

  const getFitColor = (fit: number) => {
    if (fit >= 90) return 'bg-green-500';
    if (fit >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Convert title to sentence case (lowercase for articles, prepositions, conjunctions unless first word)
  const toSentenceCase = (title: string) => {
    if (!title) return '';
    
    const lowercaseWords = ['a', 'an', 'the', 'and', 'or', 'but', 'nor', 'for', 'so', 'yet', 
                           'at', 'by', 'in', 'on', 'to', 'of', 'with', 'from', 'as', 'is'];
    
    const words = title.split(' ');
    return words.map((word, index) => {
      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      // Lowercase common words unless they're the first word
      if (lowercaseWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  const getDaysUntilDeadline = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusVariant = (status: string) => {
    if (status.toUpperCase().includes('ACTIVE')) return 'default';
    if (status.toUpperCase().includes('EMERGING')) return 'secondary';
    return 'outline';
  };

  // Helper function to generate tender cards
  const generateTenderCard = (opportunity, index) => {
    const daysUntil = getDaysUntilDeadline(opportunity.deadline);
    const fitColor = getFitColor(opportunity.yellow_panther_fit);
    const isExpired = daysUntil !== null && daysUntil < 0;
    const isUrgent = daysUntil !== null && daysUntil <= 30 && daysUntil > 0;

    return (
      <div key={opportunity.id || index} className="rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold tracking-tight text-lg mb-2">{toSentenceCase(opportunity.title)}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Building2 className="w-4 h-4" />
                <span>{opportunity.organization}</span>
                <MapPin className="w-4 h-4 ml-2" />
                <span>{opportunity.location}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={getStatusVariant(opportunity.status)}>
                {isExpired ? 'Expired' : opportunity.status || 'Active'}
              </Badge>
              <div className={`px-2 py-1 rounded text-white text-xs ${fitColor}`}>
                {opportunity.yellow_panther_fit}% Fit
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 pt-0">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {opportunity.description}
          </p>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <PoundSterling className="w-4 h-4" />
                <span className="font-medium">{opportunity.value || 'Value not specified'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className={isUrgent ? 'text-red-600 font-medium' : ''}>
                  {daysUntil !== null ? (
                    daysUntil > 0 ? `${daysUntil} days` : 'Expired'
                  ) : (
                    'No deadline'
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="w-3 h-3" />
              <span>Priority: {opportunity.priority_score}/10</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {opportunity.category}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {opportunity.type || 'RFP'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              {(() => {
                const sourceUrl = opportunity.source_url || opportunity.url || null;
                return sourceUrl && sourceUrl !== 'null' && sourceUrl.trim() !== '' ? (
                <Button size="sm" variant="outline" asChild>
                  <a 
                    href={sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Source
                  </a>
                </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled title={`No source URL available. URL values: source_url="${opportunity.source_url}", url="${opportunity.url}"`}>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Source
                  </Button>
                );
              })()}
            </div>
          </div>
          
          {opportunity.contact && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Contact:</span>
                <span>{opportunity.contact}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Function to render detected RFP cards
  const generateRFPCard = (rfp, index) => {
    const getPriorityColor = (priority) => {
      switch (priority) {
        case 'critical': return 'bg-red-500';
        case 'high': return 'bg-orange-500';
        case 'medium': return 'bg-yellow-500';
        case 'low': return 'bg-green-500';
        default: return 'bg-gray-500';
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'detected': return 'bg-blue-500';
        case 'analyzing': return 'bg-purple-500';
        case 'pursued': return 'bg-green-500';
        case 'won': return 'bg-emerald-500';
        case 'lost': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    };

    return (
      <div key={rfp.id || index} className="rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow border-green-200">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  AI Detected
                </Badge>
                <Badge className={`${getPriorityColor(rfp.priority)} text-white text-xs`}>
                  {rfp.priority}
                </Badge>
              </div>
              <h3 className="font-semibold tracking-tight text-lg mb-2">{toSentenceCase(rfp.title)}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Building2 className="w-4 h-4" />
                <span>{rfp.organization}</span>
              </div>
              {rfp.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {rfp.description}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={`${getStatusColor(rfp.status)} text-white text-xs`}>
                {rfp.status}
              </Badge>
              <div className="text-right">
                <div className="font-semibold text-green-600">{rfp.estimated_value}</div>
                <div className="text-xs text-gray-500">
                  {rfp.confidence}% match
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {rfp.deadline && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(rfp.deadline).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{new Date(rfp.detected_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {rfp.category}
              </Badge>
              <Button size="sm" variant="outline" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading Quality-Filtered Opportunities</h2>
          <p className="text-muted-foreground mb-4">Fetching real tender data with verified source links...</p>
          <div className="text-sm text-muted-foreground">
            <p>🔍 Filtering out broken and placeholder URLs</p>
            <p>📊 Validating source links for quality assurance</p>
          </div>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">No Quality Opportunities Available</h2>
          <p className="text-muted-foreground mb-4">
            We've filtered out opportunities with broken source URLs to ensure the best user experience.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🏆 Live Tender Opportunities</h1>
            <p className="text-muted-foreground">
              🎯 Comprehensive RFP intelligence from Yellow Panther analysis • {opportunities.length} curated opportunities
              {opportunities.length > 0 ? ` • High-value opportunities with verified source links` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* A2A System Status */}
      {a2aRunning && (
        <Card className="mb-6 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    A2A Autonomous Discovery Active
                  </h3>
                  <p className="text-sm text-purple-700">
                    AI agents are scanning Neo4j entities with yellowPantherPriority ≤ 5 for RFP opportunities
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {a2aStatus && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Entities:</span>
                      <span className="ml-1 font-medium">{a2aStatus.totalEntitiesProcessed || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Opportunities:</span>
                      <span className="ml-1 font-medium text-green-600">{a2aStatus.totalOpportunitiesFound || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">MCP Calls:</span>
                      <span className="ml-1 font-medium">{a2aStatus.totalMCPCalls || 0}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 text-xs text-purple-600">
              🎯 Discovered opportunities will automatically appear below and be stored to the database
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Filter Indicator */}
      {filterStatus !== 'all' && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {filterStatus === 'active_rfp' && <><Target className="w-4 h-4 text-blue-600" /><span className="font-medium text-blue-900">🎯 ACTIVE_RFP Filter: Showing real procurement opportunities with official deadlines and verified sources</span></>}
              {filterStatus === 'signal' && <><TrendingUp className="w-4 h-4 text-green-600" /><span className="font-medium text-green-900">📡 SIGNAL Filter: Showing market intelligence, partnerships, and strategic opportunities</span></>}
              {filterStatus === 'qualified' && <><span className="font-medium">✅ Qualified Filter: Showing pre-qualified opportunities</span></>}
              {filterStatus === 'expired' && <><span className="font-medium">⚰️ Expired Filter: Showing past opportunities</span></>}
              {filterStatus === 'emerging' && <><span className="font-medium">🌱 Emerging Filter: Showing potential opportunities</span></>}
              {filterStatus === 'active' && <><span className="font-medium">🟢 Active Filter: Showing currently active opportunities</span></>}
              <span className="text-sm text-muted-foreground ml-auto">
                {filteredOpportunities.length} of {opportunities.length} opportunities match
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_opportunities}</div>
            <div className="text-xs text-green-500 mt-1">From Comprehensive Analysis</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.total_value_millions}M</div>
            <div className="text-xs text-blue-500 mt-1">Confirmed Opportunities</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgent Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent_deadlines}</div>
            <div className="text-xs text-muted-foreground mt-1">Next 30 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Fit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.average_fit_score}%</div>
            <div className="text-xs text-green-500 mt-1">Yellow Panther Alignment</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search opportunities by title, organization, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active_rfp">🎯 ACTIVE_RFP</option>
              <option value="signal">📡 SIGNAL</option>
              <option value="qualified">Qualified</option>
              <option value="expired">Expired</option>
              <option value="emerging">Emerging</option>
              <option value="active">Active</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => {
                const value = e.target.value;
                setFilterSource(value);
                setShowDetectedOnly(value === 'ai-detected');
              }}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="all">All Opportunities</option>
              <option value="rfp_opportunities">RFP Opportunities</option>
              <option value="ai-detected">AI-Detected RFPs</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Grid */}
      {filterSource === 'ai-detected' && displayRFPs.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-green-700 mb-2">🎯 AI-Detected RFP Opportunities</h2>
            <p className="text-sm text-muted-foreground">
              {displayRFPs.length} opportunities detected by our autonomous A2A system
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {displayRFPs.map((rfp, index) => generateRFPCard(rfp, index))}
          </div>
        </>
      )}

      {filterSource === 'all' && (
        <>
          {displayRFPs.length > 0 && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-green-700 mb-2">🎯 AI-Detected RFP Opportunities</h2>
                <p className="text-sm text-muted-foreground">
                  {displayRFPs.length} opportunities detected by our autonomous A2A system
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {displayRFPs.map((rfp, index) => generateRFPCard(rfp, index))}
              </div>
            </>
          )}
          
          {displayOpportunities.length > 0 && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-blue-700 mb-2">📊 RFP Opportunities</h2>
                <p className="text-sm text-muted-foreground">
                  {displayOpportunities.length} live opportunities from our database of {stats.total_opportunities || 325} total records
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {displayOpportunities.map((opportunity, index) => generateTenderCard(opportunity, index))}
              </div>
            </>
          )}
        </>
      )}

      {(filterSource === 'rfp_opportunities') && displayOpportunities.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">📊 RFP Opportunities</h2>
            <p className="text-sm text-muted-foreground">
              {displayOpportunities.length} live opportunities from our database of {stats.total_opportunities || 325} total records
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {displayOpportunities.map((opportunity, index) => generateTenderCard(opportunity, index))}
          </div>
        </>
      )}

      {displayOpportunities.length === 0 && displayRFPs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filterSource === 'ai-detected' 
              ? "No AI-detected RFPs found. Start the A2A system to begin autonomous detection." 
              : filterSource === 'comprehensive'
              ? "No comprehensive opportunities found matching your criteria."
              : "No opportunities found matching your criteria."
            }
          </p>
        </div>
      )}
    </div>
  );
}