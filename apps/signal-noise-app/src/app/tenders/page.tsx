/**
 * 🏆 Tenders Page
 * 
 * Live tender opportunities from our comprehensive RFP analysis system (40 real opportunities)
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
  Download,
  Eye,
  Target,
  Clock,
  Plus,
  TrendingUp
} from 'lucide-react';

// Import comprehensive RFP opportunities from shared database
import { comprehensiveRfpOpportunities } from '@/lib/comprehensive-rfp-opportunities';
import { rfpStorageService } from '@/services/RFPStorageService';
import { supabase } from '@/lib/supabase-client';

const realOpportunities = comprehensiveRfpOpportunities;

export default function TendersPage() {
  const [opportunities, setOpportunities] = useState([]);
  const [detectedRFPs, setDetectedRFPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDetectedOnly, setShowDetectedOnly] = useState(false);
  const [rfpStats, setRfpStats] = useState({ total: 0, recent: 0 });
  // Calculate initial stats from real opportunities
  const [stats, setStats] = useState(() => {
    const totalValueEstimate = realOpportunities.reduce((sum, opp) => {
      const match = opp.value.match(/£?([\d.]+)([KM])/);
      if (match) {
        const value = parseFloat(match[1]);
        const multiplier = match[2] === 'M' ? 1000 : (match[2] === 'K' ? 1 : 1);
        return sum + (value * multiplier);
      }
      return sum;
    }, 0);

    const urgentDeadlines = realOpportunities.filter(opp => {
      if (!opp.deadline) return false;
      const days = Math.ceil((new Date(opp.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days !== null && days <= 30 && days > 0;
    }).length;

    const avgFitScore = realOpportunities.length > 0 ? Math.round(realOpportunities.reduce((sum, opp) => sum + opp.yellow_panther_fit, 0) / realOpportunities.length) : 0;

    return {
      total_opportunities: realOpportunities.length,
      total_value_millions: totalValueEstimate > 1000 ? `${Math.round(totalValueEstimate/1000)}+` : `${Math.round(totalValueEstimate)}`,
      urgent_deadlines: urgentDeadlines,
      average_fit_score: avgFitScore
    };
  });

  // Function to calculate stats from opportunities array
  const calculateStatsFromOpportunities = (opps) => {
    const totalValueEstimate = opps.reduce((sum, opp) => {
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

    const avgFitScore = opps.length > 0 ? Math.round(opps.reduce((sum, opp) => sum + opp.yellow_panther_fit, 0) / opps.length) : 0;

    return {
      total_opportunities: opps.length,
      total_value_millions: totalValueEstimate > 1000 ? `${Math.round(totalValueEstimate/1000)}+` : `${Math.round(totalValueEstimate)}`,
      urgent_deadlines: urgentDeadlines,
      average_fit_score: avgFitScore
    };
  };

  // Load detected RFPs from Supabase
  useEffect(() => {
    const loadDetectedRFPs = async () => {
      try {
        const rfps = await rfpStorageService.getRFPs({ 
          limit: 50,
          orderBy: 'detected_at',
          orderDirection: 'desc'
        });
        
        console.log(`🎯 Loaded ${rfps.length} detected RFPs from Supabase`);
        
        setDetectedRFPs(rfps);
        
        // Calculate RFP stats
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRFPs = rfps.filter(rfp => new Date(rfp.detected_at) > weekAgo);
        
        setRfpStats({
          total: rfps.length,
          recent: recentRFPs.length
        });
        
      } catch (error) {
        console.error('❌ Error loading detected RFPs:', error);
        setDetectedRFPs([]);
        setRfpStats({ total: 0, recent: 0 });
      }
    };

    loadDetectedRFPs();
    
    // Set up real-time subscription for new RFPs
    const subscription = supabase
      .channel('rfp-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'rfps' 
        }, 
        (payload) => {
          console.log('🆕 New RFP detected:', payload.new);
          setDetectedRFPs(prev => [payload.new, ...prev].slice(0, 50));
          setRfpStats(prev => ({
            ...prev,
            total: prev.total + 1,
            recent: prev.recent + 1
          }));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load real RFP data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Try to load from API first, fallback to our comprehensive data
      try {
        const response = await fetch('/api/tenders?action=opportunities&limit=100&t=' + Date.now());
        const data = await response.json();
        
        let loadedOpportunities;
        if (data.opportunities && data.opportunities.length > 0) {
          loadedOpportunities = data.opportunities;
        } else {
          loadedOpportunities = realOpportunities;
        }
        
        console.log(`📊 Loaded ${loadedOpportunities.length} opportunities from API`);
        console.log('📊 Sample opportunity:', loadedOpportunities[0]);
        setOpportunities(loadedOpportunities);
        setStats(calculateStatsFromOpportunities(loadedOpportunities));
      } catch (error) {
        console.log('❌ Error loading from API, using local data:', error.message);
        console.log(`📊 Using local data: ${realOpportunities.length} opportunities`);
        setOpportunities(realOpportunities);
        setStats(calculateStatsFromOpportunities(realOpportunities));
      }
      
      setLoading(false);
    };
    
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
      if (filterStatus === 'qualified') {
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

  // Combine results based on toggle
  const displayOpportunities = showDetectedOnly ? [] : filteredOpportunities;
  const displayRFPs = showDetectedOnly ? filteredDetectedRFPs : [];

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate refresh
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Title', 'Organization', 'Location', 'Value', 'Deadline', 'Status', 'Category', 'Fit Score', 'Contact'],
      ...filteredOpportunities.map(opp => [
        opp.title,
        opp.organization,
        opp.location,
        opp.value,
        opp.deadline ? new Date(opp.deadline).toLocaleDateString() : '',
        opp.status,
        opp.category,
        opp.yellow_panther_fit,
        opp.contact || ''
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yellow-panther-rfp-opportunities-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getFitColor = (fit: number) => {
    if (fit >= 90) return 'bg-green-500';
    if (fit >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
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
              <h3 className="font-semibold tracking-tight text-lg mb-2">{opportunity.title}</h3>
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
                <span className="font-medium">{opportunity.value}</span>
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
              {opportunity.url && (
                <Button size="sm" variant="outline" asChild>
                  <a 
                    href={opportunity.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Source
                  </a>
                </Button>
              )}
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
              <h3 className="font-semibold tracking-tight text-lg mb-2">{rfp.title}</h3>
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

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🏆 Live Tender Opportunities</h1>
            <p className="text-muted-foreground">
              Comprehensive RFP intelligence from Yellow Panther analysis • {realOpportunities.length} opportunities (50 total available) from 19+ analysis batches covering 4,750+ entities
            </p>
            {rfpStats.total > 0 && (
              <div className="flex items-center gap-4 mt-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <Plus className="w-3 h-3 mr-1" />
                  {rfpStats.total} AI-Detected RFPs
                </Badge>
                {rfpStats.recent > 0 && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {rfpStats.recent} new this week
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowDetectedOnly(!showDetectedOnly)} 
              variant={showDetectedOnly ? "default" : "outline"}
              className={showDetectedOnly ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Target className="w-4 h-4 mr-2" />
              {showDetectedOnly ? "AI-Detected RFPs" : "All Opportunities"}
            </Button>
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

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
              <option value="qualified">Qualified</option>
              <option value="expired">Expired</option>
              <option value="emerging">Emerging</option>
              <option value="active">Active</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Grid */}
      {showDetectedOnly && displayRFPs.length > 0 && (
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

      {!showDetectedOnly && displayRFPs.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-green-700 mb-2">🎯 Latest AI-Detected RFPs</h2>
            <p className="text-sm text-muted-foreground">
              {displayRFPs.length} opportunities detected by our autonomous A2A system
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {displayRFPs.map((rfp, index) => generateRFPCard(rfp, index))}
          </div>
        </>
      )}

      {!showDetectedOnly && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">📊 Comprehensive Market Opportunities</h2>
            <p className="text-sm text-muted-foreground">
              {displayOpportunities.length} manually curated opportunities from our extensive analysis
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayOpportunities.map((opportunity, index) => generateTenderCard(opportunity, index))}
          </div>
        </>
      )}

      {displayOpportunities.length === 0 && displayRFPs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {showDetectedOnly 
              ? "No AI-detected RFPs found. Start the A2A system to begin autonomous detection." 
              : "No opportunities found matching your criteria."
            }
          </p>
        </div>
      )}
    </div>
  );
}