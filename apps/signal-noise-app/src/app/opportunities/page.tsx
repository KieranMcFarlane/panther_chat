'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Filter, Target, TrendingUp } from 'lucide-react';
import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell';
import { FacetFilterBar, type FacetFilterField } from '@/components/filters/FacetFilterBar';
import { Badge } from '@/components/ui/badge';
import { Command, CommandInput } from '@/components/ui/command';
import { buildCanonicalOpportunitySearchText, matchesCanonicalSearch } from '@/lib/canonical-search';
import { buildOpportunityFacetOptions, getOpportunityTaxonomyDisplayValues, normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs';

type OpportunityTaxonomy = {
  sport: string;
  competition: string;
  entity_role: string;
  opportunity_kind: string;
  theme: string;
};

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
  sport?: string | null;
  competition?: string | null;
  entity_role?: string | null;
  opportunity_kind?: string | null;
  theme?: string | null;
  taxonomy?: OpportunityTaxonomy | null;
  metadata?: Record<string, unknown> | null;
  source_url: string | null;
  tags: string[] | null;
  detected_at: string | null;
  status?: string | null;
  confidence_score?: number | null;
}

interface OpportunityCard {
  id: string;
  title: string;
  opportunityKind: string;
  organization: string;
  sport: string;
  competition: string;
  entityRole: string;
  country: string;
  theme: string;
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
  taxonomy: OpportunityTaxonomy;
}

function normalizeOpportunity(opp: TenderOpportunityRecord): OpportunityCard {
  const organization = opp.canonical_entity_name || opp.entity_name || opp.organization || 'Unknown organization';
  const fit = opp.yellow_panther_fit ?? 0;
  const confidence = opp.confidence ?? 0;
  const priority = opp.priority_score ?? 0;
  const taxonomy = opp.taxonomy || normalizeOpportunityTaxonomy({
    ...opp,
    organization,
    title: opp.title,
    description: opp.description,
    category: opp.category,
    metadata: opp.metadata || undefined,
  });
  const displayTaxonomy = getOpportunityTaxonomyDisplayValues(taxonomy);

  return {
    id: opp.id,
    title: opp.title || organization,
    opportunityKind: taxonomy.opportunity_kind || 'Other',
    organization,
    sport: displayTaxonomy.sport,
    competition: displayTaxonomy.competition,
    entityRole: displayTaxonomy.entity_role,
    country: opp.location || 'Unknown',
    theme: displayTaxonomy.theme,
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
    taxonomy,
  };
}

function OpportunitiesContent() {
  const searchParams = useSearchParams();
  const focusedEntityId = searchParams.get('entityId') || '';
  const focusedEntityName = searchParams.get('entityName') || '';

  const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
  const [searchQuery, setSearchQuery] = useState(focusedEntityName);
  const [sportFilter, setSportFilter] = useState('all');
  const [competitionFilter, setCompetitionFilter] = useState('all');
  const [entityRoleFilter, setEntityRoleFilter] = useState('all');
  const [opportunityKindFilter, setOpportunityKindFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
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

        const response = await fetch('/api/tenders?action=opportunities&limit=100&promoted_only=true', {
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

    void loadOpportunities();
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
        matchesCanonicalSearch(searchQuery, buildCanonicalOpportunitySearchText(opp)),
      );
    }

    if (sportFilter !== 'all') filtered = filtered.filter((opp) => opp.sport === sportFilter);
    if (competitionFilter !== 'all') filtered = filtered.filter((opp) => opp.competition === competitionFilter);
    if (entityRoleFilter !== 'all') filtered = filtered.filter((opp) => opp.entityRole === entityRoleFilter);
    if (opportunityKindFilter !== 'all') filtered = filtered.filter((opp) => opp.opportunityKind === opportunityKindFilter);
    if (themeFilter !== 'all') filtered = filtered.filter((opp) => opp.theme === themeFilter);

    if (scoreFilter !== 'all') {
      const minScore = scoreFilter === 'high' ? 8 : scoreFilter === 'medium' ? 6 : 0;
      filtered = filtered.filter((opp) => opp.criticalOpportunityScore >= minScore);
    }

    return filtered.sort((a, b) => b.criticalOpportunityScore - a.criticalOpportunityScore);
  }, [competitionFilter, entityRoleFilter, focusedEntityId, focusedEntityName, opportunityKindFilter, opportunities, scoreFilter, searchQuery, sportFilter, themeFilter]);

  const taxonomyFacetOptions = useMemo(() => buildOpportunityFacetOptions(opportunities), [opportunities]);

  const filterFields: FacetFilterField[] = [
    {
      key: 'sport',
      label: 'Sport',
      value: sportFilter,
      placeholder: 'Sport',
      options: taxonomyFacetOptions.sport,
      onValueChange: setSportFilter,
    },
    {
      key: 'competition',
      label: 'Competition',
      value: competitionFilter,
      placeholder: 'Competition',
      options: taxonomyFacetOptions.competition,
      onValueChange: setCompetitionFilter,
    },
    {
      key: 'entity-role',
      label: 'Role',
      value: entityRoleFilter,
      placeholder: 'Role',
      options: taxonomyFacetOptions.entity_role,
      onValueChange: setEntityRoleFilter,
    },
    {
      key: 'opportunity-kind',
      label: 'Opportunity Kind',
      value: opportunityKindFilter,
      placeholder: 'Opportunity Kind',
      options: taxonomyFacetOptions.opportunity_kind,
      onValueChange: setOpportunityKindFilter,
    },
    {
      key: 'theme',
      label: 'Theme',
      value: themeFilter,
      placeholder: 'Theme',
      options: taxonomyFacetOptions.theme,
      onValueChange: setThemeFilter,
    },
    {
      key: 'score',
      label: 'Score',
      value: scoreFilter,
      placeholder: 'Score',
      options: [
        { value: 'all', label: 'All scores' },
        { value: 'high', label: 'High (8+)' },
        { value: 'medium', label: 'Medium (6+)' },
        { value: 'low', label: 'Low (0+)' },
      ],
      onValueChange: setScoreFilter,
    },
  ];

  const filterChips = [
    searchQuery ? { key: 'query', label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery('') } : null,
    sportFilter !== 'all' ? { key: 'sport', label: `Sport: ${sportFilter}`, onRemove: () => setSportFilter('all') } : null,
    competitionFilter !== 'all' ? { key: 'competition', label: `Competition: ${competitionFilter}`, onRemove: () => setCompetitionFilter('all') } : null,
    entityRoleFilter !== 'all' ? { key: 'entity-role', label: `Role: ${entityRoleFilter}`, onRemove: () => setEntityRoleFilter('all') } : null,
    opportunityKindFilter !== 'all' ? { key: 'opportunity-kind', label: `Opportunity Kind: ${opportunityKindFilter}`, onRemove: () => setOpportunityKindFilter('all') } : null,
    themeFilter !== 'all' ? { key: 'theme', label: `Theme: ${themeFilter}`, onRemove: () => setThemeFilter('all') } : null,
    scoreFilter !== 'all' ? { key: 'score', label: `Score: ${scoreFilter}`, onRemove: () => setScoreFilter('all') } : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const resetFilters = () => {
    setSearchQuery('');
    setSportFilter('all');
    setCompetitionFilter('all');
    setEntityRoleFilter('all');
    setOpportunityKindFilter('all');
    setThemeFilter('all');
    setScoreFilter('all');
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getOpportunityKindColor = (kind: string) => {
    switch (kind) {
      case 'RFP':
        return 'bg-blue-500';
      case 'Tender':
        return 'bg-indigo-500';
      case 'Procurement':
        return 'bg-emerald-500';
      case 'Partnership':
        return 'bg-purple-500';
      case 'Grant':
        return 'bg-teal-500';
      case 'Hosting':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getCanonicalContext = (parts: Array<string | null | undefined>) =>
    parts
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' · ');

  if (loading) {
    return (
      <AppPageShell>
        <AppPageHeader
          eyebrow="Opportunities"
          title="Canonical opportunities"
          description="Loading the canonical source-of-truth opportunities."
        />
        <AppPageBody>
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border/70 bg-card/70">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-yellow-400" />
          </div>
        </AppPageBody>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppPageHeader
        eyebrow="Opportunities"
        title="Canonical opportunities"
        description="This page shows canonicalized opportunities promoted from intake. Legacy content has been removed."
      />
      <AppPageBody>
        {(focusedEntityId || focusedEntityName) && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Focused canonical view</div>
                <p className="mt-1 text-sm text-emerald-100/90">
                  Reviewing canonical opportunities for {focusedEntityName || focusedEntityId}. This keeps the entity and dossier handoff inside the source of truth.
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">
                {filteredOpportunities.length} matching opportunities
              </Badge>
            </div>
          </div>
        )}

        <FacetFilterBar
          searchSlot={(
            <Command className="overflow-visible rounded-md border border-input bg-background shadow-sm">
              <CommandInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search club, sport, country, league..."
                className="h-11 border-0 pl-2"
              />
            </Command>
          )}
          fields={filterFields}
          actions={[
            {
              key: 'reset',
              label: 'Reset filters',
              onClick: resetFilters,
              variant: 'outline',
              icon: <Filter className="h-4 w-4" />,
            },
          ]}
          chips={filterChips}
          status={(
            <div className="flex items-center text-sm text-fm-light-grey">
              <Filter className="mr-2 h-4 w-4" />
              {filteredOpportunities.length} of {opportunities.length}
            </div>
          )}
        />

        {loadError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredOpportunities.map((opportunity) => (
            <div
              key={opportunity.id}
              className="min-w-0 rounded-lg border border-custom-border bg-custom-box p-4 transition-colors hover:border-yellow-400"
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="break-words text-lg font-semibold text-white">{opportunity.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-fm-medium-grey">
                    <span>{opportunity.organization}</span>
                  </div>
                  <div className="mt-1 text-sm text-fm-light-grey">
                    <span className="font-medium text-fm-medium-grey">Canonical context:</span>{' '}
                    {getCanonicalContext([opportunity.sport, opportunity.country, opportunity.competition, opportunity.entityRole])}
                  </div>
                </div>
                <Badge variant="secondary" className={`${getOpportunityKindColor(opportunity.opportunityKind)} text-white text-xs`}>
                  {opportunity.opportunityKind}
                </Badge>
              </div>

              <p className="mb-4 text-sm text-fm-light-grey">{opportunity.description}</p>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
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
                {opportunity.theme ? (
                  <Badge key={`${opportunity.id}-theme`} variant="outline" className="text-xs">
                    {opportunity.theme}
                  </Badge>
                ) : null}
              {opportunity.tags.map((tag) => (
                  <Badge key={`${opportunity.id}-${tag}`} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4 text-xs text-fm-medium-grey">
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
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-fm-medium-grey">
                {opportunity.canonicalEntityId && (
                  <a
                    className="underline underline-offset-4 hover:text-white"
                    href={`/entity-browser/${encodeURIComponent(opportunity.canonicalEntityId)}/dossier?from=1`}
                  >
                    Open canonical dossier
                  </a>
                )}
                {opportunity.sourceUrl && (
                  <a
                    className="underline underline-offset-4 hover:text-white"
                    href={opportunity.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredOpportunities.length === 0 && (
          <div className="py-12 text-center">
            <Target className="mx-auto mb-4 h-16 w-16 text-fm-medium-grey opacity-50" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              {focusedEntityId || focusedEntityName ? 'No canonical matches yet' : 'Nothing has been promoted into the canonical surface yet'}
            </h3>
            <p className="mx-auto max-w-2xl text-fm-medium-grey">
              {focusedEntityId || focusedEntityName
                ? `No canonical opportunities are linked to ${focusedEntityName || focusedEntityId} yet. Review the live RFP feed or rerun scout to create the first canonical match.`
                : 'Adjust the filters or move back to RFP\'s/Tenders to review the broader live feed.'}
            </p>
          </div>
        )}
      </AppPageBody>
    </AppPageShell>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-fm-light-grey">Loading opportunities...</div>}>
      <OpportunitiesContent />
    </Suspense>
  );
}
