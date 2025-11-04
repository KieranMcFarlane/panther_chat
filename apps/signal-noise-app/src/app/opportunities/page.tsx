'use client';

import { useState, useEffect } from 'react';
import { Target, TrendingUp, Calendar, DollarSign, Star, Filter, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db, Entity, CriticalOpportunityScore } from '@/lib/database';

interface Opportunity extends Entity, CriticalOpportunityScore {
  id: string; // For UI compatibility
  title: string;
  type: 'tender' | 'partnership' | 'sponsorship' | 'acquisition' | 'investment';
  club: string;
  sport: string;
  country: string;
  deadline?: string;
  value?: string;
  description: string;
  lastUpdated: string;
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        setLoading(true);
        const opportunitiesData = await db.getOpportunities(50);
        const opportunitiesWithUI = opportunitiesData.map((opp, index) => ({
          ...opp,
          id: opp.entity_id || `opp-${index}`,
          title: opp.entity_type === 'tender' ? (opp as any).title : opp.name,
          type: opp.entity_type === 'tender' ? 'tender' : 'partnership',
          club: opp.entity_type === 'club' ? opp.name : 'Unknown',
          sport: 'Football', // Default sport
          country: opp.entity_type === 'club' ? (opp as any).location?.split(', ')[1] || 'Unknown' : 'Unknown',
          deadline: opp.entity_type === 'tender' ? (opp as any).deadline : undefined,
          value: opp.entity_type === 'club' ? (opp as any).revenue_estimate : undefined,
          description: opp.notes || 'No description available',
          lastUpdated: opp.last_updated
        }));
        
        setOpportunities(opportunitiesWithUI);
        setFilteredOpportunities(opportunitiesWithUI);
      } catch (error) {
        console.error('Error loading opportunities:', error);
        // Fallback to mock data if database fails
        const mockOpportunities: Opportunity[] = [
          {
            entity_id: '1',
            entity_type: 'tender',
            title: 'Old Trafford Stadium Upgrade Tender',
            type: 'tender',
            club: 'Manchester United FC',
            sport: 'Football',
            country: 'England',
            deadline: '2024-12-31',
            value: '£50M',
            description: 'Major stadium renovation project including seating, facilities, and technology upgrades.',
            lastUpdated: '2024-01-20',
            source: 'manual',
            last_updated: '2024-01-20',
            trust_score: 8.8,
            vector_embedding: [],
            priority_score: 9.5,
            notes: 'Stadium upgrade tender',
            associated_club_id: 'MUFC001',
            division_id: 'Premier League',
            linked_contacts: [],
            tags: ['Infrastructure', 'High Value', 'Stadium', 'Technology'],
            critical_opportunity_score: 9.2,
            influence_score: 9.0,
            poi_score: 8.5,
            vector_similarity: 0.92,
            id: '1'
          }
        ];
        setOpportunities(mockOpportunities);
        setFilteredOpportunities(mockOpportunities);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  useEffect(() => {
    let filtered = opportunities;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(opp =>
        opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.club.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(opp => opp.type === typeFilter);
    }

    // Apply sport filter
    if (sportFilter !== 'all') {
      filtered = filtered.filter(opp => opp.sport === sportFilter);
    }

    // Apply score filter
    if (scoreFilter !== 'all') {
      const minScore = scoreFilter === 'high' ? 8 : scoreFilter === 'medium' ? 6 : 0;
      filtered = filtered.filter(opp => opp.criticalOpportunityScore >= minScore);
    }

    // Sort by critical opportunity score
    filtered.sort((a, b) => b.criticalOpportunityScore - a.criticalOpportunityScore);

    setFilteredOpportunities(filtered);
  }, [opportunities, searchQuery, typeFilter, sportFilter, scoreFilter]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tender': return 'bg-blue-500';
      case 'sponsorship': return 'bg-green-500';
      case 'partnership': return 'bg-purple-500';
      case 'acquisition': return 'bg-orange-500';
      case 'investment': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tender': return '📋';
      case 'sponsorship': return '🤝';
      case 'partnership': return '🔗';
      case 'acquisition': return '🏢';
      case 'investment': return '💰';
      default: return '🎯';
    }
  };

  const uniqueSports = Array.from(new Set(opportunities.map(o => o.sport)));
  const uniqueTypes = Array.from(new Set(opportunities.map(o => o.type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Opportunities</h1>
          <p className="text-fm-light-grey">High-value opportunities ranked by critical score</p>
        </div>
        <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
          <Target className="w-4 h-4 mr-2" />
          Add Opportunity
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-custom-box border border-custom-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-custom-bg border-custom-border text-white placeholder:text-fm-medium-grey"
          />
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-custom-bg border-custom-border text-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-custom-box border-custom-border text-white">
              <SelectItem value="all">All types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="bg-custom-bg border-custom-border text-white">
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent className="bg-custom-box border-custom-border text-white">
              <SelectItem value="all">All sports</SelectItem>
              {uniqueSports.map((sport) => (
                <SelectItem key={sport} value={sport}>{sport}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="bg-custom-bg border-custom-border text-white">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent className="bg-custom-box border-custom-border text-white">
              <SelectItem value="all">All scores</SelectItem>
              <SelectItem value="high">High (8+)</SelectItem>
              <SelectItem value="medium">Medium (6+)</SelectItem>
              <SelectItem value="low">Low (0+)</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-fm-light-grey text-sm flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            {filteredOpportunities.length} of {opportunities.length}
          </div>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOpportunities.map((opportunity) => (
          <div
            key={opportunity.id}
            className="bg-custom-box border border-custom-border rounded-lg p-4 hover:border-yellow-400 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getTypeIcon(opportunity.type)}</span>
                <div>
                  <h3 className="font-semibold text-white text-lg">{opportunity.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-fm-medium-grey">
                    <span>{opportunity.club}</span>
                    <span>•</span>
                    <span>{opportunity.sport}</span>
                    <span>•</span>
                    <span>{opportunity.country}</span>
                  </div>
                </div>
              </div>
              <Badge 
                variant="secondary" 
                className={`${getTypeColor(opportunity.type)} text-white text-xs`}
              >
                {opportunity.type}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-fm-light-grey text-sm mb-4">{opportunity.description}</p>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(opportunity.criticalOpportunityScore)}`}>
                  {opportunity.criticalOpportunityScore}
                </div>
                <div className="text-xs text-fm-medium-grey">Critical Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400">
                  {opportunity.value || 'N/A'}
                </div>
                <div className="text-xs text-fm-medium-grey">Value</div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.priorityScore)}`}>
                  {opportunity.priorityScore}
                </div>
                <div className="text-fm-medium-grey">Priority</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.trustScore)}`}>
                  {opportunity.trustScore}
                </div>
                <div className="text-fm-medium-grey">Trust</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.influenceScore)}`}>
                  {opportunity.influenceScore}
                </div>
                <div className="text-fm-medium-grey">Influence</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.poiScore)}`}>
                  {opportunity.poiScore}
                </div>
                <div className="text-fm-medium-grey">POI</div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-4">
              {opportunity.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-fm-medium-grey">
                {opportunity.deadline && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Deadline: {opportunity.deadline}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Vector: {Math.round(opportunity.vectorSimilarity * 100)}%</span>
                </div>
              </div>
              <div className="text-xs text-fm-medium-grey">
                Updated: {opportunity.lastUpdated}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" className="flex-1">
                <Star className="w-3 h-3 mr-1" />
                View Details
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <Target className="w-3 h-3 mr-1" />
                Track
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-16 h-16 mx-auto text-fm-medium-grey mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-white mb-2">No opportunities found</h3>
          <p className="text-fm-medium-grey">Try adjusting your search criteria or add new opportunities</p>
        </div>
      )}
    </div>
  );
}
