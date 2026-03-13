'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { useEntitySummaries, useEntity } from '@/lib/swr-config';
import { useVectorSearch } from '@/hooks/useVectorSearch';
import {
  canonicalizeLeagueName,
  canonicalizeEntityType,
  getEntityLeague,
  getEntitySport,
  resolveStableEntityId,
  toEntityTypeLabel,
} from '@/lib/entity-taxonomy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronUp, ChevronDown, Search, ArrowLeft } from 'lucide-react';

type SummaryEntity = {
  id: string;
  graph_id?: string;
  name: string;
  type?: string;
  entity_type?: string;
  sport?: string;
  country?: string;
  league?: string;
  level?: string;
};

type NavEntity = {
  id: string;
  graph_id: string;
  properties: {
    name: string;
    type: string;
    entity_type: string;
    sport: string;
    country: string;
    league: string;
  };
};

type LeagueGroup = {
  league: string;
  sport: string;
  entities: NavEntity[];
};

type SportGroup = {
  sport: string;
  leagues: LeagueGroup[];
};

function getLeagueBucketName(entity: NavEntity): string {
  const explicitLeague = getEntityLeague(entity);
  if (explicitLeague) return explicitLeague;

  const canonicalType = canonicalizeEntityType(entity);
  if (canonicalType === 'league') {
    return canonicalizeLeagueName(entity.properties.name || 'League');
  }

  return `${toEntityTypeLabel(canonicalType)} Entities`;
}

function sortByName<T extends { properties: { name: string } }>(items: T[]) {
  return [...items].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
}

export default function LeagueNavSimple() {
  const router = useRouter();
  const params = useParams();
  const entityId = String(params?.entityId || '');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [currentEntityIndex, setCurrentEntityIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const { entity: currentEntityData } = useEntity(entityId || null);
  const { summaries } = useEntitySummaries('/api/entities/summary');

  const { results: vectorResults, loading: isVectorSearching } = useVectorSearch(
    searchTerm,
    { limit: 10, threshold: 0.3, entityType: '' },
    'vector'
  );

  const sportsData: SportGroup[] = useMemo(() => {
    const summaryRows = Array.isArray(summaries) ? summaries : [];
    if (!summaryRows.length) return [];

    const entities: NavEntity[] = summaryRows.map((summary: SummaryEntity) => {
      const stableId = String(summary.graph_id || summary.id || '');
      const fallbackType = summary.entity_type || summary.type || 'unknown';
      const entityLike = {
        id: stableId,
        graph_id: stableId,
        properties: {
          name: summary.name,
          type: summary.type,
          entity_type: summary.entity_type,
          sport: summary.sport,
          country: summary.country,
          league: summary.league || summary.level,
        },
        labels: summary.type ? [summary.type] : [],
      };
      return {
        id: stableId,
        graph_id: stableId,
        properties: {
          name: summary.name || stableId,
          type: String(summary.type || fallbackType),
          entity_type: canonicalizeEntityType(entityLike),
          sport: getEntitySport(entityLike) || 'Other Sports',
          country: summary.country || 'Unknown',
          league: getEntityLeague(entityLike),
        },
      };
    });

    const sportMap = new Map<string, Map<string, NavEntity[]>>();

    for (const entity of entities) {
      const sport = entity.properties.sport || 'Other Sports';
      const leagueBucket = getLeagueBucketName(entity);

      if (!sportMap.has(sport)) {
        sportMap.set(sport, new Map<string, NavEntity[]>());
      }

      const leagues = sportMap.get(sport)!;
      if (!leagues.has(leagueBucket)) {
        leagues.set(leagueBucket, []);
      }
      leagues.get(leagueBucket)!.push(entity);
    }

    return Array.from(sportMap.entries())
      .map(([sport, leagues]) => ({
        sport,
        leagues: Array.from(leagues.entries())
          .map(([league, items]) => ({
            league,
            sport,
            entities: sortByName(items),
          }))
          .sort((a, b) => a.league.localeCompare(b.league)),
      }))
      .sort((a, b) => a.sport.localeCompare(b.sport));
  }, [summaries]);

  const currentEntity = useMemo(() => {
    if (currentEntityData) {
      const stableId = resolveStableEntityId(currentEntityData) || String(currentEntityData.id || entityId);
      const entityLike = {
        id: stableId,
        graph_id: stableId,
        labels: currentEntityData.labels || [],
        properties: currentEntityData.properties || {},
      };
      return {
        id: stableId,
        graph_id: stableId,
        properties: {
          name: currentEntityData.properties?.name || stableId,
          type: currentEntityData.properties?.type || 'Unknown',
          entity_type: canonicalizeEntityType(entityLike),
          sport: getEntitySport(entityLike) || 'Other Sports',
          country: currentEntityData.properties?.country || 'Unknown',
          league: getEntityLeague(entityLike),
        },
      } as NavEntity;
    }

    const allEntities = sportsData.flatMap((sport) => sport.leagues.flatMap((league) => league.entities));
    return allEntities.find((candidate) => candidate.id === entityId || candidate.graph_id === entityId) || null;
  }, [currentEntityData, entityId, sportsData]);

  const currentLeague = useMemo(() => {
    if (!currentEntity) return null;
    for (const sport of sportsData) {
      for (const league of sport.leagues) {
        if (league.entities.some((member) => member.id === currentEntity.id || member.graph_id === currentEntity.graph_id)) {
          return league;
        }
      }
    }
    return null;
  }, [currentEntity, sportsData]);

  useEffect(() => {
    if (!currentLeague || isNavigating) return;
    const index = currentLeague.entities.findIndex(
      (member) => member.id === currentEntity?.id || member.graph_id === currentEntity?.graph_id
    );
    if (index >= 0) {
      setCurrentEntityIndex(index);
    }
  }, [currentEntity?.graph_id, currentEntity?.id, currentLeague, isNavigating]);

  const navigateToEntity = useCallback((entity: NavEntity) => {
    const targetId = String(entity.graph_id || entity.id);
    if (!targetId || isNavigating) return;

    setIsNavigating(true);
    router.push(`/entity/${targetId}`);
    setTimeout(() => setIsNavigating(false), 350);
  }, [isNavigating, router]);

  const handleUp = useCallback(() => {
    if (!currentLeague || currentLeague.entities.length === 0 || isNavigating) return;
    const nextIndex = currentEntityIndex > 0 ? currentEntityIndex - 1 : currentLeague.entities.length - 1;
    setCurrentEntityIndex(nextIndex);
    navigateToEntity(currentLeague.entities[nextIndex]);
  }, [currentEntityIndex, currentLeague, isNavigating, navigateToEntity]);

  const handleDown = useCallback(() => {
    if (!currentLeague || currentLeague.entities.length === 0 || isNavigating) return;
    const nextIndex = currentEntityIndex < currentLeague.entities.length - 1 ? currentEntityIndex + 1 : 0;
    setCurrentEntityIndex(nextIndex);
    navigateToEntity(currentLeague.entities[nextIndex]);
  }, [currentEntityIndex, currentLeague, isNavigating, navigateToEntity]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isModalOpen) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleUp();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleDown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, handleUp, handleDown]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) {
      return { type: 'browsing' as const, data: sportsData };
    }

    if (vectorResults?.length) {
      return { type: 'vector' as const, data: vectorResults };
    }

    const normalizedTerm = searchTerm.toLowerCase();
    const filtered = sportsData
      .map((sport) => ({
        ...sport,
        leagues: sport.leagues
          .map((league) => ({
            ...league,
            entities: league.entities.filter(
              (entity) =>
                entity.properties.name.toLowerCase().includes(normalizedTerm) ||
                league.league.toLowerCase().includes(normalizedTerm)
            ),
          }))
          .filter((league) => league.entities.length > 0),
      }))
      .filter((sport) => sport.leagues.length > 0);

    return { type: 'local' as const, data: filtered };
  }, [searchTerm, sportsData, vectorResults]);

  const handleSearchSubmit = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || searchResults.type !== 'vector' || searchResults.data.length === 0) return;

    const result = searchResults.data[0];
    const candidate: NavEntity = {
      id: String(result.entity.id),
      graph_id: String(result.entity.id),
      properties: {
        name: String(result.entity.properties.name || result.entity.id),
        type: String(result.entity.properties.type || 'Unknown'),
        entity_type: String(result.entity.properties.entity_type || result.entity.properties.type || 'unknown'),
        sport: String(result.entity.properties.sport || 'Other Sports'),
        country: String(result.entity.properties.country || 'Unknown'),
        league: String(result.entity.properties.league || ''),
      },
    };

    navigateToEntity(candidate);
    setIsModalOpen(false);
    setSearchTerm('');
  };

  const displayLeague = currentLeague;
  const displaySport = selectedSport || currentLeague?.sport;
  const currentEntityTypeLabel = toEntityTypeLabel(
    currentEntity ? canonicalizeEntityType(currentEntity) : 'unknown'
  );

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-header-bg">
          <DialogHeader>
            <DialogTitle>
              {displaySport ? `${displaySport} → ${displayLeague?.league || 'Groups'}` : 'Select Sport'}
            </DialogTitle>
            <DialogDescription>
              {displaySport
                ? `Browse ${displayLeague?.entities?.length || 0} entities in ${displayLeague?.league || 'group'}`
                : 'Choose a sport to browse leagues and entities'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isVectorSearching ? 'animate-pulse' : ''}`} />
              <Input
                placeholder="Search entities, leagues, or federations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className={`pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 ${isVectorSearching ? 'opacity-80' : ''}`}
                disabled={isVectorSearching}
              />
            </div>

            {selectedSport && (
              <Button variant="ghost" onClick={() => setSelectedSport(null)} className="text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Sports
              </Button>
            )}

            {searchResults.type === 'vector' ? (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                <div className="text-sm text-white/60 mb-2">Vector search results for &quot;{searchTerm}&quot;</div>
                {searchResults.data.map((result: any) => {
                  const targetId = String(result.entity.graph_id || result.entity.id);
                  return (
                    <div
                      key={targetId}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white/10 text-white"
                      onClick={() => {
                        router.push(`/entity/${targetId}`);
                        setIsModalOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      <div>
                        <div className="font-medium">{result.entity.properties.name}</div>
                        <div className="text-sm text-white/60">
                          {result.entity.properties.league || toEntityTypeLabel(canonicalizeEntityType({ properties: result.entity.properties, labels: result.entity.labels || [] }))}
                          {' '}• {result.entity.properties.country || 'Unknown'}
                        </div>
                        <div className="text-xs text-yellow-400">{Math.round(result.similarity * 100)}% match</div>
                      </div>
                      <div className="text-sm text-white/60">→</div>
                    </div>
                  );
                })}
              </div>
            ) : !selectedSport ? (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {searchResults.data.map((sport: SportGroup) => (
                  <div
                    key={sport.sport}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white/10 text-white"
                    onClick={() => setSelectedSport(sport.sport)}
                  >
                    <div>
                      <div className="font-medium">{sport.sport}</div>
                      <div className="text-sm text-white/60">
                        {sport.leagues.length} groups • {sport.leagues.reduce((sum, league) => sum + league.entities.length, 0)} entities
                      </div>
                    </div>
                    <div className="text-sm text-white/60">→</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {searchResults.data
                  .find((sport: SportGroup) => sport.sport === selectedSport)
                  ?.leagues.map((league: LeagueGroup) => (
                    <div
                      key={league.league}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        currentLeague?.league === league.league ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white'
                      }`}
                      onClick={() => {
                        if (league.entities.length > 0) {
                          navigateToEntity(league.entities[0]);
                        }
                        setSelectedSport(null);
                        setIsModalOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-medium">{league.league}</div>
                        <div className="text-sm text-white/60">
                          {league.entities.length} entities
                        </div>
                      </div>
                      <div className="text-sm text-white/60">→</div>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="text-sm text-white/60">
                {searchResults.type === 'vector'
                  ? `Found ${searchResults.data.length} similar entities`
                  : searchTerm
                  ? `Found ${searchResults.data.reduce((sum: number, sport: SportGroup) => sum + sport.leagues.length, 0)} groups`
                  : `Browsing: ${displaySport || 'All Sports'}`}
              </div>
              <Button onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="cursor-pointer" onClick={() => setIsModalOpen(true)}>
        <EntityBadge
          entity={currentEntity}
          size="xl"
          className={`transition-all ${isNavigating ? 'opacity-60 scale-95' : ''}`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          disabled={!currentLeague || currentLeague.entities.length <= 1 || isNavigating}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          disabled={!currentLeague || currentLeague.entities.length <= 1 || isNavigating}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-w-[120px]">
        <div className="text-white text-3xl font-extrabold mb-1">{currentEntity?.properties?.name || 'Loading...'}</div>
        <div className="text-white/60 text-xl">
          {currentLeague?.league || currentEntityTypeLabel} / {currentEntity?.properties?.country || 'Unknown'}
        </div>
      </div>
    </div>
  );
}
