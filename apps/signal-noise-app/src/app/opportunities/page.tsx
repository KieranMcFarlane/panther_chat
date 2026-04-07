'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Filter, Search, Star, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TenderOpportunityRecord {
  id: string;
  title: string;
  organization: string;
  description: string | null;
  location: string | null;
  value: string | null;
  deadline: string | null;
  category: string | null;
  priority: string | null;
  priority_score: number | null;
  confidence: number | null;
  yellow_panther_fit: number | null;
  entity_id: string | null;
  entity_name: string | null;
  canonical_entity_id?: string | null;
  canonical_entity_name?: string | null;
  entity_type: string | null;
  source_url: string | null;
  tags: string[] | null;
  detected_at: string | null;
}

interface OpportunityCard {
  id: string;
  title: string;
  type: string;
  organization: string;
  sport: string;
  country: string;
  deadline?: string;
  value?: string;
  description: string;
  lastUpdated: string;
  criticalOpportunityScore: number;
  priorityScore: number;
  trustScore: number;
  influenceScore: number;
  poiScore: number;
  vectorSimilarity: number;
  tags: string[];
  entityId?: string;
  entityName?: string;
  canonicalEntityId?: string;
  canonicalEntityName?: string;
  sourceUrl?: string;
}

function normalizeOpportunity(opp: TenderOpportunityRecord): OpportunityCard {
  const category = opp.category || 'General';
  const organization = opp.canonical_entity_name || opp.entity_name || opp.organization || 'Unknown organization';
  const fit = opp.yellow_panther_fit ?? 0;
  const confidence = opp.confidence ?? 0;
  const priority = opp.priority_score ?? 0;

  return {
    id: opp.id,
    title: opp.title || organization,
    type: category.toLowerCase().includes('sponsor') ? 'sponsorship' : category.toLowerCase().includes('partner') ? 'partnership' : 'tender',
    organization,
    sport: category,
    country: opp.location || 'Unknown',
    deadline: opp.deadline || undefined,
    value: opp.value || undefined,
    description: opp.description || 'No description available',
    lastUpdated: opp.detected_at || 'Unknown',
    criticalOpportunityScore: Math.round(fit / 10),
    priorityScore: Math.max(0, Math.round(priority)),
    trustScore: Math.max(0, Math.round(confidence / 10)),
    influenceScore: Math.max(0, Math.round((fit + confidence) / 20)),
    poiScore: Math.max(0, Math.round((fit + priority) / 20)),
    vectorSimilarity: Math.max(0, Math.min(1, fit / 100)),
    tags: Array.isArray(opp.tags) ? opp.tags : [],
    entityId: opp.entity_id || undefined,
    entityName: opp.entity_name || undefined,
    canonicalEntityId: opp.canonical_entity_id || undefined,
    canonicalEntityName: opp.canonical_entity_name || undefined,
    sourceUrl: opp.source_url || undefined,
  };
}

function OpportunitiesContent() {
  const searchParams = useSearchParams();
  const focusedEntityId = searchParams.get('entityId') || '';
  const focusedEntityName = searchParams.get('entityName') || '';

  const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
  const [searchQuery, setSearchQuery] = useState(focusedEntityName);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(focusedEntityName);
  }, [focusedEntityName]);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        setLoading(true);
        setLoadError(null);

        const response = await fetch('/api/tenders?action=opportunities&limit=100', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to load opportunities (${response.status})`);
        }

        const payload = await response.json();
        const mapped = Array.isArray(payload?.opportunities)
          ? payload.opportunities.map(normalizeOpportunity)
          : [];

        setOpportunities(mapped);
      } catch (error) {
        console.error('Error loading opportunities:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load opportunities');
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];

    if (focusedEntityId || focusedEntityName) {
      filtered = filtered.filter((opp) =>
        (focusedEntityId && (opp.canonicalEntityId === focusedEntityId || opp.entityId === focusedEntityId)) ||
        (focusedEntityName && [opp.canonicalEntityName, opp.entityName, opp.organization, opp.title].some((value) =>
          String(value || '').toLowerCase().includes(focusedEntityName.toLowerCase())))
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((opp) =>
        [opp.title, opp.organization, opp.description].some((value) =>
          String(value || '').toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((opp) => opp.type === typeFilter);
    }

    if (sportFilter !== 'all') {
      filtered = filtered.filter((opp) => opp.sport === sportFilter);
    }

    if (scoreFilter !== 'all') {
      const minScore = scoreFilter === 'high' ? 8 : scoreFilter === 'medium' ? 6 : 0;
      filtered = filtered.filter((opp) => opp.criticalOpportunityScore >= minScore);
    }

    return filtered.sort((a, b) => b.criticalOpportunityScore - a.criticalOpportunityScore);
  }, [focusedEntityId, focusedEntityName, opportunities, scoreFilter, searchQuery, sportFilter, typeFilter]);

  const uniqueSports = Array.from(new Set(opportunities.map((opportunity) => opportunity.sport))).filter(Boolean);
  const uniqueTypes = Array.from(new Set(opportunities.map((opportunity) => opportunity.type))).filter(Boolean);
  const highConvictionCount = filteredOpportunities.filter((opp) => opp.criticalOpportunityScore >= 8).length;
  const trackedValueCount = filteredOpportunities.filter((opp) => Boolean(opp.value)).length;
  const averageScore = filteredOpportunities.length
    ? (filteredOpportunities.reduce((sum, opp) => sum + opp.criticalOpportunityScore, 0) / filteredOpportunities.length).toFixed(1)
    : '0.0';

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tender':
        return 'bg-blue-500';
      case 'sponsorship':
        return 'bg-green-500';
      case 'partnership':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-custom-border bg-custom-box px-6 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">
              <Star className="h-3.5 w-3.5" />
              Decision Surface
            </div>
            <h1 className="mb-2 text-3xl font-bold text-white">Opportunity Shortlist</h1>
            <p className="text-fm-light-grey">
              Curated opportunities ranked for Yellow Panther action. This page is for deciding what to pursue next,
              not for scanning the full raw feed.
            </p>
            <p className="mt-3 text-sm text-fm-medium-grey">
              Only promoted shortlist candidates should live here. Raw intake stays in RFP&apos;s/Tenders.
            </p>
          </div>
          <Button className="self-start bg-yellow-500 text-black hover:bg-yellow-400 lg:self-auto">
            <Target className="mr-2 h-4 w-4" />
            Add to Pursuit Queue
          </Button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Shortlisted</div>
            <div className="mt-2 text-3xl font-semibold text-white">{filteredOpportunities.length}</div>
          </div>
          <div className="rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">High Conviction</div>
            <div className="mt-2 text-3xl font-semibold text-green-400">{highConvictionCount}</div>
          </div>
          <div className="rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">With Value Signal</div>
            <div className="mt-2 text-3xl font-semibold text-yellow-300">{trackedValueCount}</div>
          </div>
          <div className="rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Average Score</div>
            <div className="mt-2 text-3xl font-semibold text-white">{averageScore}</div>
          </div>
        </div>
      </div>

      {(focusedEntityId || focusedEntityName) && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Focused decision view</div>
              <p className="mt-1 text-sm text-emerald-100/90">
                Reviewing shortlist candidates for {focusedEntityName || focusedEntityId}. This keeps the entity and dossier handoff inside the decision surface.
              </p>
              {filteredOpportunities.length === 0 && (
                <p className="mt-2 text-sm text-emerald-100/75">
                  No intake-linked opportunities found for {focusedEntityName || focusedEntityId} yet. The live feed is still available in RFP&apos;s/Tenders, and this shortlist will populate once intake is promoted into the canonical entity.
                </p>
              )}
            </div>
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">
              {filteredOpportunities.length} matching opportunities
            </Badge>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-custom-border bg-custom-box p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Shortlist Filters</h2>
            <p className="text-sm text-fm-medium-grey">Refine what is worth review, outreach, or pursuit.</p>
          </div>
          <div className="flex items-center text-sm text-fm-light-grey">
            <Filter className="mr-2 h-4 w-4" />
            {filteredOpportunities.length} of {opportunities.length}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-fm-medium-grey" />
            <Input
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="border-custom-border bg-custom-bg pl-9 text-white placeholder:text-fm-medium-grey"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="border-custom-border bg-custom-bg text-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="border-custom-border bg-custom-box text-white">
              <SelectItem value="all">All types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="border-custom-border bg-custom-bg text-white">
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent className="border-custom-border bg-custom-box text-white">
              <SelectItem value="all">All categories</SelectItem>
              {uniqueSports.map((sport) => (
                <SelectItem key={sport} value={sport}>{sport}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="border-custom-border bg-custom-bg text-white">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent className="border-custom-border bg-custom-box text-white">
              <SelectItem value="all">All scores</SelectItem>
              <SelectItem value="high">High (8+)</SelectItem>
              <SelectItem value="medium">Medium (6+)</SelectItem>
              <SelectItem value="low">Low (0+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filteredOpportunities.map((opportunity) => (
          <div
            key={opportunity.id}
            className="rounded-lg border border-custom-border bg-custom-box p-4 transition-colors hover:border-yellow-400"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{opportunity.title}</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-fm-medium-grey">
                  <span>{opportunity.organization}</span>
                  <span>•</span>
                  <span>{opportunity.sport}</span>
                  <span>•</span>
                  <span>{opportunity.country}</span>
                </div>
              </div>
              <Badge variant="secondary" className={`${getTypeColor(opportunity.type)} text-white text-xs`}>
                {opportunity.type}
              </Badge>
            </div>

            <p className="mb-4 text-sm text-fm-light-grey">{opportunity.description}</p>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(opportunity.criticalOpportunityScore)}`}>
                  {opportunity.criticalOpportunityScore}
                </div>
                <div className="text-xs text-fm-medium-grey">Critical Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400">{opportunity.value || 'N/A'}</div>
                <div className="text-xs text-fm-medium-grey">Value</div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.priorityScore)}`}>{opportunity.priorityScore}</div>
                <div className="text-fm-medium-grey">Priority</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.trustScore)}`}>{opportunity.trustScore}</div>
                <div className="text-fm-medium-grey">Trust</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.influenceScore)}`}>{opportunity.influenceScore}</div>
                <div className="text-fm-medium-grey">Influence</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${getScoreColor(opportunity.poiScore)}`}>{opportunity.poiScore}</div>
                <div className="text-fm-medium-grey">POI</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1">
              {opportunity.tags.map((tag) => (
                <Badge key={`${opportunity.id}-${tag}`} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-fm-medium-grey">
                {opportunity.deadline && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Decision date: {opportunity.deadline}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Vector: {Math.round(opportunity.vectorSimilarity * 100)}%</span>
                </div>
              </div>
              <div className="text-xs text-fm-medium-grey">
                Updated: {opportunity.lastUpdated}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <Star className="mr-1 h-3 w-3" />
                Review Fit
              </Button>
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <a href={opportunity.sourceUrl || '/tenders'}>
                  <Target className="mr-1 h-3 w-3" />
                  Add to Pipeline
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="py-12 text-center">
          <Target className="mx-auto mb-4 h-16 w-16 text-fm-medium-grey opacity-50" />
          <h3 className="mb-2 text-xl font-semibold text-white">
            {focusedEntityId || focusedEntityName ? 'No entity-linked opportunities yet' : 'Nothing has been promoted into the shortlist yet'}
          </h3>
          <p className="mx-auto max-w-2xl text-fm-medium-grey">
            {focusedEntityId || focusedEntityName
              ? `No shortlist items are linked to ${focusedEntityName || focusedEntityId} in the current intake feed. Review the live RFP feed or run Scout to create the first linked opportunity.`
              : 'Adjust the filters or move back to RFP\'s/Tenders to review the broader live feed.'}
          </p>
          {(focusedEntityId || focusedEntityName) && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline" className="border-custom-border bg-custom-box text-white hover:bg-custom-bg">
                <Link href="/tenders">Open RFP&apos;s/Tenders</Link>
              </Button>
              <Button asChild className="bg-yellow-500 text-black hover:bg-yellow-400">
                <Link href="/tenders">Open Live Feed</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-fm-light-grey">Loading opportunities...</div>}>
      <OpportunitiesContent />
    </Suspense>
  );
}
