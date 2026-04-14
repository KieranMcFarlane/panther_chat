'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, ChevronDown, ChevronUp, Filter, Target, TrendingUp } from 'lucide-react';
import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell';
import { FacetFilterBar, type FacetFilterField } from '@/components/filters/FacetFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  whyItMatters: string;
  fitFeedback: string;
  suggestedAction: string;
  nextSteps: string;
  signalSummary: string;
  readMoreSummary: string;
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

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toLabel(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(toLabel).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return toText(record.name || record.title || record.label || record.value || record.summary || record.description);
  }
  return String(value).trim();
}

function toLabelList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(toLabel).filter(Boolean);
}

function readDossierNarrative(metadata: Record<string, unknown>) {
  const graphitiSalesBrief = asRecord(metadata.graphiti_sales_brief);
  const yellowPantherOpportunity = asRecord(metadata.yellow_panther_opportunity);
  const serviceFit = toLabelList(yellowPantherOpportunity.service_fit).length > 0
    ? toLabelList(yellowPantherOpportunity.service_fit)
    : toLabelList(graphitiSalesBrief.service_fit);
  const decisionOwners = toLabelList(metadata.decision_owners);
  const signals = [
    ...toLabelList(yellowPantherOpportunity.signals),
    ...toLabelList(graphitiSalesBrief.signals),
    ...toLabelList(metadata.signals),
    ...toLabelList(metadata.evidence),
  ];

  const whyItMatters =
    toText(graphitiSalesBrief.capability_gap) ||
    toText(yellowPantherOpportunity.competitive_advantage) ||
    toText(metadata.why_it_matters) ||
    toText(metadata.summary) ||
    'This dossier has a qualified commercial signal.';

  const suggestedAction =
    toText(graphitiSalesBrief.outreach_route) ||
    toText(graphitiSalesBrief.outreach_target) ||
    toText(graphitiSalesBrief.best_path_owner) ||
    toText(yellowPantherOpportunity.entry_point) ||
    toText(metadata.suggested_action) ||
    'Open the dossier and review the buyer hypothesis.';

  const fitFeedback =
    toText(yellowPantherOpportunity.fit_feedback) ||
    toText(metadata.yellow_panther_fit_feedback) ||
    (serviceFit.length > 0
      ? `Yellow Panther fit is strongest where the dossier maps to ${serviceFit.slice(0, 3).join(', ')}.`
      : 'Yellow Panther fit is inferred from the dossier-level commercial signal and the closest service adjacency.');

  const nextSteps =
    toText(graphitiSalesBrief.next_step) ||
    toText(graphitiSalesBrief.action_plan) ||
    toText(yellowPantherOpportunity.next_step) ||
    toText(metadata.next_step) ||
    (decisionOwners.length > 0
      ? `Open the dossier, validate the decision owners, and draft outreach toward ${decisionOwners.slice(0, 3).join(', ')}.`
      : 'Open the dossier, validate the buyer hypothesis, and draft a targeted outreach step.');

  const signalSummary = [
    serviceFit.length > 0 ? `YP fit: ${serviceFit.slice(0, 3).join(', ')}` : '',
    decisionOwners.length > 0 ? `Decision owners: ${decisionOwners.slice(0, 3).join(', ')}` : '',
    toText(graphitiSalesBrief.outreach_angle) ? `Angle: ${toText(graphitiSalesBrief.outreach_angle)}` : '',
    toText(yellowPantherOpportunity.entry_point) ? `Entry point: ${toText(yellowPantherOpportunity.entry_point)}` : '',
    toText(metadata.quality_state) ? `Quality: ${toText(metadata.quality_state)}` : '',
  ].filter(Boolean).join(' · ');

  return {
    whyItMatters,
    fitFeedback,
    suggestedAction,
    nextSteps,
    signalSummary,
    readMoreSummary: signals.slice(0, 4).join(' · '),
  };
}

function normalizeOpportunity(opp: TenderOpportunityRecord): OpportunityCard {
  const organization = opp.canonical_entity_name || opp.entity_name || opp.organization || 'Unknown organization';
  const fit = opp.yellow_panther_fit ?? 0;
  const confidence = opp.confidence ?? 0;
  const priority = opp.priority_score ?? 0;
  const metadata = asRecord(opp.metadata);
  const narrative = readDossierNarrative(metadata);
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
    description: narrative.whyItMatters || opp.description || 'No description available',
    whyItMatters: narrative.whyItMatters,
    suggestedAction: narrative.suggestedAction,
    signalSummary: narrative.signalSummary,
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
  const [openOpportunityId, setOpenOpportunityId] = useState<string | null>(null);
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

        const response = await fetch('/api/opportunities', {
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
          title="Opportunity Shortlist"
          description="Loading the canonical Graphiti-backed shortlist."
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
        title="Opportunity Shortlist"
        description="Curated opportunities ranked from the Graphiti materialized feed. This page is for deciding what to pursue next, not for scanning the raw intake."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/entity-browser">Open dossier workspace</Link>
          </Button>
        }
      />
      <AppPageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Shortlisted</div>
            <div className="mt-2 text-3xl font-semibold text-white">{filteredOpportunities.length}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">High Conviction</div>
            <div className="mt-2 text-3xl font-semibold text-green-400">{highConvictionCount}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">With Value Signal</div>
            <div className="mt-2 text-3xl font-semibold text-yellow-300">{trackedValueCount}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Average Score</div>
            <div className="mt-2 text-3xl font-semibold text-white">{averageScore}</div>
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
                    No canonical Graphiti opportunities are linked to {focusedEntityName || focusedEntityId} yet. The dossier workspace is still available, and this shortlist will populate once the pipeline materializes a promoted insight.
                  </p>
                )}
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

              <div className="mb-4 space-y-3">
                <p className="text-sm text-fm-light-grey">{opportunity.description}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-custom-border bg-black/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Why this is an opportunity</div>
                    <div className="mt-1 text-sm text-white">{opportunity.whyItMatters}</div>
                  </div>
                  <div className="rounded-md border border-custom-border bg-black/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Yellow Panther fit</div>
                    <div className="mt-1 text-sm text-white">{opportunity.fitFeedback}</div>
                  </div>
                  <div className="rounded-md border border-custom-border bg-black/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Suggested action</div>
                    <div className="mt-1 text-sm text-white">{opportunity.suggestedAction}</div>
                  </div>
                  <div className="rounded-md border border-custom-border bg-black/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Next steps</div>
                    <div className="mt-1 text-sm text-white">{opportunity.nextSteps}</div>
                  </div>
                </div>

                {opportunity.signalSummary ? (
                  <div className="rounded-md border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-50">
                    {opportunity.signalSummary}
                  </div>
                ) : null}
              </div>

              {openOpportunityId === opportunity.id && (
                <div className="mb-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Read more</div>
                  <div className="mt-2 grid gap-3 text-sm text-white sm:grid-cols-2">
                    <div>
                      <div className="font-medium text-yellow-100">What to look for</div>
                      <div className="mt-1 text-fm-light-grey">
                        {opportunity.readMoreSummary || 'Review the dossier for the supporting evidence, decision owners, and commercial signal details.'}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-yellow-100">What to do next</div>
                      <div className="mt-1 text-fm-light-grey">{opportunity.nextSteps}</div>
                    </div>
                  </div>
                </div>
              )}

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
                {[...new Set(opportunity.tags)].map((tag, index) => (
                  <Badge key={`${opportunity.id}-${tag}-${index}`} variant="outline" className="text-xs">
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

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpenOpportunityId(openOpportunityId === opportunity.id ? null : opportunity.id)}
                >
                  {openOpportunityId === opportunity.id ? (
                    <ChevronUp className="mr-1 h-3 w-3" />
                  ) : (
                    <ChevronDown className="mr-1 h-3 w-3" />
                  )}
                  {openOpportunityId === opportunity.id ? 'Read less' : 'Read more'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={opportunity.sourceUrl || '/entity-browser'}>
                    <Target className="mr-1 h-3 w-3" />
                    Open dossier
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
                ? `No shortlist items are linked to ${focusedEntityName || focusedEntityId} in the current canonical Graphiti feed yet. Review the dossier workspace or rerun the pipeline to create the first linked opportunity.`
                : 'Adjust the filters or revisit the dossier workspace after Graphiti materialization completes.'}
            </p>
            {(focusedEntityId || focusedEntityName) && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button asChild variant="outline" className="border-custom-border bg-custom-box text-white hover:bg-custom-bg">
                  <Link href="/entity-browser">Open dossier workspace</Link>
                </Button>
                <Button asChild className="bg-yellow-500 text-black hover:bg-yellow-400">
                  <Link href="/entity-browser">Open canonical source</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </AppPageBody>
    </AppPageShell>
  );
}

export default function OpportunitiesClientPage() {
  return <OpportunitiesContent />;
}
