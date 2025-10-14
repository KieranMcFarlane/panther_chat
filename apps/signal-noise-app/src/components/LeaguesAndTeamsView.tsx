'use client';

import React, { useState, useMemo } from 'react';
import { useLeagues, useTeams, League, Team } from '@/hooks/useLeaguesAndTeams';

interface LeaguesAndTeamsViewProps {
  className?: string;
}

export function LeaguesAndTeamsView({ className }: LeaguesAndTeamsViewProps) {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const { leagues, isLoading: leaguesLoading } = useLeagues({ includeTeams: true });
  const { teams, pagination, isLoading: teamsLoading } = useTeams({
    leagueId: selectedLeague || undefined,
    letter: selectedLetter !== 'all' ? selectedLetter : undefined,
    search: searchTerm || undefined,
    limit: 50,
  });

  // Generate A-Z letters for filtering
  const letters = useMemo(() => {
    if (!teams.length) return [];
    const uniqueLetters = new Set(
      teams.map(team => team.name?.charAt(0).toUpperCase()).filter(Boolean)
    );
    return Array.from(uniqueLetters).sort();
  }, [teams]);

  // Group teams by first letter for display
  const teamsByLetter = useMemo(() => {
    const grouped: Record<string, Team[]> = {};
    teams.forEach(team => {
      const firstLetter = team.name?.charAt(0).toUpperCase() || '#';
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(team);
    });
    // Sort teams within each letter group
    Object.keys(grouped).forEach(letter => {
      grouped[letter].sort((a, b) => a.name.localeCompare(b.name));
    });
    return grouped;
  }, [teams]);

  if (leaguesLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <h2 className="text-2xl font-bold mb-6">Sports Leagues & Teams</h2>
      
      {/* League Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Select League</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLeague(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedLeague === null 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Leagues
          </button>
          {leagues.map(league => (
            <button
              key={league.id}
              onClick={() => setSelectedLeague(league.id)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                selectedLeague === league.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {league.badge_path && (
                <img 
                  src={league.badge_path} 
                  alt={league.name} 
                  className="w-5 h-5 rounded"
                />
              )}
              {league.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Letter Filter */}
      <div className="mb-6 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {letters.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filter by letter:</h4>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedLetter('all')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedLetter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {letters.map(letter => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    selectedLetter === letter 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Teams Display */}
      {teamsLoading ? (
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No teams found for the selected criteria.
        </div>
      ) : (
        <div>
          <div className="mb-4 text-sm text-gray-600">
            Showing {teams.length} of {pagination?.total || 0} teams
          </div>
          
          {Object.entries(teamsByLetter).map(([letter, letterTeams]) => (
            <div key={letter} className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">{letter}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {letterTeams.map(team => (
                  <div 
                    key={team.id} 
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {team.badge_path && (
                        <img 
                          src={team.badge_path} 
                          alt={team.name} 
                          className="w-8 h-8 rounded"
                        />
                      )}
                      <h4 className="font-semibold text-gray-900">{team.name}</h4>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      {team.level && (
                        <div>League: {team.level}</div>
                      )}
                      {team.country && (
                        <div>Country: {team.country}</div>
                      )}
                      {team.founded && (
                        <div>Founded: {team.founded}</div>
                      )}
                      {team.estimated_value && (
                        <div>Value: {team.estimated_value}</div>
                      )}
                      {team.opportunity_score && (
                        <div className="flex items-center gap-1">
                          <span>Opportunity Score:</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${team.opportunity_score}%` }}
                            />
                          </div>
                          <span className="text-xs">{team.opportunity_score}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}