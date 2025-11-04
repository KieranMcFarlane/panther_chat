'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Users, Trophy, MapPin, Globe, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, Club, Sportsperson, BaseEntity } from '@/lib/database';

interface Division {
  id: string;
  name: string;
  country: string;
  level: string;
  clubCount: number;
  clubs: Club[];
}

export default function SportsPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSportsData() {
      try {
        setLoading(true);
        const hierarchy = await db.getSportsHierarchy();
        setDivisions(hierarchy.divisions);
      } catch (error) {
        console.error('Error loading sports data:', error);
        // Fallback to mock data if database fails
        const mockDivisions: Division[] = [
          {
            id: '1',
            name: 'Premier League',
            country: 'England',
            level: 'Top Tier',
            clubCount: 20,
            clubs: [
              {
                entity_id: '1',
                entity_type: 'club',
                name: 'Manchester United FC',
                division_id: 'Premier League',
                location: 'Manchester, England',
                source: 'manual',
                last_updated: new Date().toISOString(),
                trust_score: 8.8,
                vector_embedding: [],
                priority_score: 9.2,
                notes: 'Premier League club',
                digital_presence_score: 8.5,
                revenue_estimate: '£580M',
                key_personnel: ['CEO', 'Manager'],
                opportunity_score: 9.2,
                linked_tenders: [],
                tags: ['Football', 'Premier League', 'Global Brand']
              }
            ]
          }
        ];
        setDivisions(mockDivisions);
      } finally {
        setLoading(false);
      }
    }

    loadSportsData();
  }, []);

  const filteredDivisions = divisions.filter(div =>
    div.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    div.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

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
          <h1 className="text-3xl font-bold text-white mb-2 page-title">Sports Intelligence</h1>
          <p className="text-fm-light-grey">Explore divisions, clubs, and sportspeople</p>
        </div>
        <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
          <Trophy className="w-4 h-4 mr-2" />
          Add Division
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search divisions, clubs, or sportspeople..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-custom-box border-custom-border text-white placeholder:text-fm-medium-grey"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Divisions List */}
        <div className="lg:col-span-1">
          <div className="bg-custom-box border border-custom-border rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">Divisions</h2>
            <div className="space-y-2">
              {filteredDivisions.map((division) => (
                <div
                  key={division.id}
                  onClick={() => setSelectedDivision(division)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedDivision?.id === division.id
                      ? 'bg-yellow-500 text-black'
                      : 'hover:bg-custom-bg text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{division.name}</div>
                      <div className="text-sm opacity-75">{division.country}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {division.clubCount} clubs
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clubs List */}
        <div className="lg:col-span-1">
          <div className="bg-custom-box border border-custom-border rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Clubs {selectedDivision && `- ${selectedDivision.name}`}
            </h2>
            {selectedDivision ? (
              <div className="space-y-3">
                {selectedDivision.clubs.map((club) => (
                  <div
                    key={club.id}
                    onClick={() => setSelectedClub(club)}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      selectedClub?.id === club.id
                        ? 'bg-yellow-500 text-black'
                        : 'hover:bg-custom-bg text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{club.name}</div>
                      <Badge variant="outline" className="text-xs">
                        Score: {club.opportunityScore}
                      </Badge>
                    </div>
                    <div className="text-sm opacity-75 mb-2">{club.location}</div>
                    <div className="flex items-center gap-4 text-xs">
                      <span>👥 {club.sportspersonCount}</span>
                      <span>💻 {club.digitalPresenceScore}</span>
                      <span>💰 {club.revenueEstimate}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-fm-medium-grey py-8">
                Select a division to view clubs
              </div>
            )}
          </div>
        </div>

        {/* Club Details */}
        <div className="lg:col-span-1">
          <div className="bg-custom-box border border-custom-border rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Details {selectedClub && `- ${selectedClub.name}`}
            </h2>
            {selectedClub ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">Club Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-fm-medium-grey">Location:</span>
                      <span className="text-white">{selectedClub.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fm-medium-grey">Division:</span>
                      <span className="text-white">{selectedClub.division}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fm-medium-grey">Sportspersons:</span>
                      <span className="text-white">{selectedClub.sportspersonCount}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Scores</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-fm-medium-grey">Digital Presence:</span>
                      <span className={getScoreColor(selectedClub.digitalPresenceScore)}>
                        {selectedClub.digitalPresenceScore}/10
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fm-medium-grey">Opportunity Score:</span>
                      <span className={getScoreColor(selectedClub.opportunityScore)}>
                        {selectedClub.opportunityScore}/10
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedClub.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400">
                  View Full Profile
                </Button>
              </div>
            ) : (
              <div className="text-center text-fm-medium-grey py-8">
                Select a club to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
