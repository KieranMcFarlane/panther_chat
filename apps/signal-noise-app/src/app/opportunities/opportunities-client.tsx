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
import { buildGraphitiOpportunityBriefing } from '@/lib/graphiti-opportunity-briefing';
import type { GraphitiOpportunityCard, GraphitiOpportunityResponse } from '@/lib/graphiti-opportunity-contract';
import { buildOpportunityFacetOptions, getOpportunityTaxonomyDisplayValues, normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs';

type OpportunityTaxonomy = {
  sport: string;
  competition: string;
  entity_role: string;
  opportunity_kind: string;
  theme: string;
};

type OpportunityTemporalReasoning = NonNullable<GraphitiOpportunityCard['temporal_reasoning']>;
type OpportunityPatternReasoning = NonNullable<GraphitiOpportunityCard['pattern_reasoning']>;
type OpportunityFinding = NonNullable<GraphitiOpportunityCard['findings']>[number];
type OpportunityTimelineEvent = NonNullable<GraphitiOpportunityCard['timeline']>[number];
type OpportunityRelatedPattern = NonNullable<GraphitiOpportunityCard['related_patterns']>[number];
type CommercialStateTab = 'outreach_ready' | 'verify_now' | 'watch' | 'context_only' | 'data_issue';
type CommercialSort = 'freshest' | 'yp_fit' | 'evidence';

const OPPORTUNITY_SURFACE_CLASS = 'rounded-2xl border border-slate-700 bg-[#101a2b] p-5 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.8)]';
const OPPORTUNITY_CARD_CLASS = 'rounded-xl border border-slate-700 bg-[#14233a] p-4';
const OPPORTUNITY_PANEL_CLASS = 'rounded-md border border-slate-700 bg-[#101a2b] p-3';
const OPPORTUNITY_ACCENT_PANEL_CLASS = 'rounded-md border border-slate-600 bg-[#182941] p-3';

interface OpportunityCard {
  id: string;
  title: string;
  briefingTitle: string;
  signalCategory: string;
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
  supportingSignals: string[];
  signalSummary: string;
  readMoreContext: string;
  lastUpdated: string;
  temporalReasoning?: OpportunityTemporalReasoning;
  patternReasoning?: OpportunityPatternReasoning;
  ypFitReasoning: string;
  recommendedAction: string;
  approachStrategy: string;
  successRationale: string;
  verificationCaveat: string;
  strategyNextSteps: string;
  signalStrength: string;
  verificationStatus: string;
  triggerText: string;
  patternConfidence: string;
  routeText: string;
  nextMove: string;
  outreachOpener: string;
  checkBeforeOutreach: string;
  decisionSummary: string;
  findings: OpportunityFinding[];
  timeline: OpportunityTimelineEvent[];
  relatedPatterns: OpportunityRelatedPattern[];
  temporalStatus: string;
  signalType: string;
  criticalOpportunityScore: number;
  priorityScore: number;
  trustScore: number;
  influenceScore: number;
  poiScore: number;
  vectorSimilarity: number;
  ypRelevance: number;
  commercialConfidence: string;
  tags: string[];
  entityId?: string;
  entityName?: string;
  canonicalEntityId?: string;
  canonicalEntityName?: string;
  sourceUrl?: string;
  taxonomy: OpportunityTaxonomy;
}

interface ReviewableDossierCandidate {
  opportunity_id: string;
  entity_name?: string;
  canonical_entity_id?: string;
  title?: string;
  status?: string;
  is_active?: boolean;
  recommendation_tier?: string;
  commercial_state?: string;
  quality_state?: string;
  commercial_status?: string;
  temporal_status?: string;
  promotion_reason?: string;
  promotion_blockers?: string[];
  promotion_score?: number;
  yp_relevance?: number;
  commercial_confidence?: string;
  commercial_confidence_score?: number;
  commercial_truth_reasons?: string[];
  useful_fact_count?: number;
  raw_answer_count?: number;
  evidence_count?: number;
  dossier_quality_blockers?: string[];
  suggested_verification_action?: string;
  bd_brief?: {
    signal_title?: string;
    brief_verdict?: string;
    decision_summary?: string;
    what_happened?: string;
    why_it_matters_now?: string;
    trigger?: string;
    what_changed?: string;
    why_it_matters?: string;
    yellow_panther_angle?: string;
    suggested_route?: string;
    next_move?: string;
    outreach_opener?: string;
    outreach_hypothesis?: string;
    verify_before_action?: string | string[];
  };
  yellow_panther_fit?: number;
  watch_item?: boolean;
  dossier_url?: string;
  updated_at?: string;
}

function normalizeBriefVerdictLabel(value?: string) {
  if (value === 'data_quality_issue') return 'Data quality issue'
  if (value === 'needs_fresh_trigger') return 'Needs fresh trigger'
  if (value === 'verify_trigger') return 'Verify trigger'
  if (value === 'context_only') return 'Context only'
  return 'Research lead'
}

interface OpportunityDiagnosticsResponse {
  active_shortlist_count?: number;
  watch_item_count?: number;
  verify_now_count?: number;
  verify_now_recommendations?: ReviewableDossierCandidate[];
  commercial_state_counts?: Partial<Record<CommercialStateTab, number>>;
  commercial_state_cards?: Partial<Record<CommercialStateTab, ReviewableDossierCandidate[]>>;
  commercial_state_pagination?: {
    state?: CommercialStateTab;
    page?: number;
    page_size?: number;
    commercial_sort?: CommercialSort;
    total?: number;
    total_pages?: number;
    has_previous?: boolean;
    has_next?: boolean;
  };
  reviewable_dossier_candidate_count?: number;
  reviewable_dossier_candidates?: ReviewableDossierCandidate[];
}

function objectToText(value: Record<string, unknown>): string {
  const fields = [
    value.finding,
    value.summary,
    value.answer,
    value.value,
    value.text,
    value.title,
    value.description,
    value.reason,
    value.label,
  ];

  for (const field of fields) {
    const text = toText(field);
    if (text) return text;
  }

  return '';
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(' · ').trim();
  }
  if (typeof value === 'object') {
    return objectToText(value as Record<string, unknown>);
  }

  const text = String(value).trim();
  return text === '[object Object]' ? '' : text;
}

function stripPlaceholderFragments(value: string): string {
  return value
    .replace(/,\s*No deterministic answer was produced for this question\.?/gi, '')
    .replace(/No deterministic answer was produced for this question\.?,?\s*/gi, '')
    .replace(/,\s*No BrightData tool or service is available in this session[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function conciseText(value: unknown, maxLength = 260): string {
  const cleaned = stripPlaceholderFragments(toText(value));
  if (!cleaned || cleaned.toLowerCase() === 'n/a') return '';
  if (cleaned.length <= maxLength) return cleaned;

  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (sentence && sentence.length <= maxLength) return sentence;
  return `${cleaned.slice(0, Math.max(40, maxLength - 1)).trim()}...`;
}

function conciseBlockText(value: unknown, maxLength = 520): string {
  const cleaned = stripPlaceholderFragments(toText(value));
  if (!cleaned || cleaned.toLowerCase() === 'n/a') return '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(80, maxLength - 1)).trim()}...`;
}

function conciseList(values: unknown[], limit = 3): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = conciseText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }

  return output;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const hiringSignalTitlePattern = /recruitment analyst|recruitment.*vacanc|hiring signal|vacancy/i;

function formatSpecificSignalTitle(organization: string, title: string, supportingSignals: string[], opportunityKind: string): string {
  const haystack = [title, ...supportingSignals].join(' ');

  if (/doncaster rovers/i.test(organization) && hiringSignalTitlePattern.test(haystack)) {
    return 'Doncaster Rovers — Recruitment Analyst vacancy';
  }

  if (/recruitment analyst/i.test(haystack)) {
    return `${organization} — Recruitment Analyst vacancy`;
  }

  const escapedOrganization = organization.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanedTitle = title
    .replace(new RegExp(`^${escapedOrganization}\\s*[:—-]\\s*`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedTitle && !/^hiring signal$/i.test(cleanedTitle)) {
    return `${organization} — ${cleanedTitle}`;
  }

  return `${organization} — ${opportunityKind || 'Opportunity signal'}`;
}

function formatSignalCategory(title: string, opportunityKind: string): string {
  if (/recruitment analyst|hiring|vacanc/i.test(title)) return 'Hiring';
  if (/grant|funding/i.test(opportunityKind) && !/hiring|vacanc/i.test(title)) return 'Funding';
  if (/tender|rfp|procurement/i.test(title)) return 'Procurement';
  return opportunityKind || 'Signal';
}

function formatSignalStrength(fit: number, confidence: number, temporalStatus: string): string {
  if (fit >= 75 && confidence >= 60 && ['active', 'accelerating'].includes(temporalStatus)) return 'High';
  if (fit >= 55 || confidence >= 50) return 'Medium';
  return 'Low';
}

function formatVerificationStatus(status: string): string {
  return /verified|qualified/i.test(status) ? 'Needs verification' : 'Needs verification';
}

function formatPatternConfidence(patternReasoning?: OpportunityPatternReasoning): string {
  const status = conciseText(patternReasoning?.pattern_status || patternReasoning?.summary, 160);
  return status || 'Single signal; validate before treating as a repeatable pattern.';
}

function formatOutreachOpener(triggerText: string, ypAngle: string, routeText: string): string {
  if (/recruitment analyst/i.test(triggerText)) {
    return 'Noticed Doncaster are hiring around recruitment analysis. We help clubs turn recruitment and market signals into practical intelligence for scouting, academy planning, and decision-making.';
  }

  const routeClause = routeText ? ` Route through ${routeText} once buyer ownership is confirmed.` : '';
  return `${triggerText} ${ypAngle}${routeClause}`.replace(/\s+/g, ' ').trim();
}

function isDoncasterRecruitmentSignal(briefingTitle: string): boolean {
  return /Doncaster Rovers/i.test(briefingTitle) && /Recruitment Analyst vacancy/i.test(briefingTitle);
}

function strategyBriefForOpportunity(opportunity: GraphitiOpportunityCard): any {
  return opportunity.strategy_brief || opportunity.briefing || null;
}

function formatVerifyBeforeAction(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => conciseText(item, 160)).filter(Boolean).join(' ')
  return conciseText(value, 260)
}

function splitNumberedBriefText(value: unknown): { intro: string; items: string[] } | null {
  const clean = toText(value).replace(/\s+/g, ' ').trim()
  if (!/\(\d+\)/.test(clean)) return null

  const parts = clean
    .split(/\s*(?=\(\d+\)\s*)/)
    .map((part) => part.trim())
    .filter(Boolean)
  const intro = parts[0] && !/^\(\d+\)/.test(parts[0]) ? parts.shift() || '' : ''
  const items = parts
    .map((part) => part.replace(/^\(\d+\)\s*/, '').replace(/[;,.]\s*$/, '').trim())
    .filter((part) => part.length > 0)

  return items.length >= 2 ? { intro, items } : null
}

function renderBriefText(value: unknown, className = 'mt-1 text-sm text-slate-100') {
  const numbered = splitNumberedBriefText(value)
  if (!numbered) return <p className={className}>{toText(value)}</p>

  return (
    <div className={className}>
      {numbered.intro ? <p>{numbered.intro}</p> : null}
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {numbered.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function conciseRecommendationTitle(recommendation: ReviewableDossierCandidate): string {
  return recommendation.bd_brief?.signal_title
    || recommendation.entity_name
    || recommendation.title?.split(':')[0]
    || 'Untitled recommendation'
}

function formatCommercialStateSignalLabel(card: ReviewableDossierCandidate): string {
  const raw = `${card.bd_brief?.signal_title || ''} ${card.title || ''}`.toLowerCase()

  if (/hiring|vacanc|recruitment|role/.test(raw)) return 'Hiring'
  if (/app|mobile|ott|platform|digital|fan engagement|broadcast|stream/.test(raw)) return 'Digital product'
  if (/funding|grant|investment|budget/.test(raw)) return 'Funding'
  if (/procurement|rfp|tender|vendor|supplier/.test(raw)) return 'Procurement'
  if (/partner|sponsor|commercial expansion/.test(raw)) return 'Partnership'
  if (/academy|scouting|player|recruitment/.test(raw)) return 'Football operations'

  return 'Commercial signal'
}

function normalizeOpportunity(opp: GraphitiOpportunityCard): OpportunityCard {
  const opportunity = opp;
  const briefing = strategyBriefForOpportunity(opportunity) || buildGraphitiOpportunityBriefing(opportunity);
  const organization = opp.canonical_entity_name || opp.entity_name || opp.organization || 'Unknown organization';
  const fit = opp.yellow_panther_fit ?? 0;
  const confidence = opp.confidence ?? 0;
  const priority = opp.priority_score ?? 0;
  const metadata = typeof opp.metadata === 'object' && opp.metadata && !Array.isArray(opp.metadata) ? opp.metadata : {};
  const commercialQualification = recordValue(metadata.commercial_qualification);
  const ypFitBreakdown = recordValue(commercialQualification.yp_fit_breakdown);
  const taxonomy = opp.taxonomy || normalizeOpportunityTaxonomy({
    ...opp,
    organization,
    title: opp.title,
    description: opp.description,
    category: opp.category,
    metadata: opp.metadata || undefined,
  });
  const displayTaxonomy = getOpportunityTaxonomyDisplayValues(taxonomy);
  const temporalReasoning = opp.temporal_reasoning || undefined;
  const patternReasoning = opp.pattern_reasoning || undefined;
  const findings = Array.isArray(opp.findings) ? opp.findings : [];
  const timeline = Array.isArray(opp.timeline) ? opp.timeline : [];
  const relatedPatterns = Array.isArray(opp.related_patterns) ? opp.related_patterns : [];
  const findingTexts = findings.slice(0, 3).map((finding) => conciseText(finding.finding));
  const rawNextSteps = Array.isArray(opp.next_steps) ? opp.next_steps : [];
  const recommendedAction = conciseBlockText(opp.recommended_action)
    || conciseBlockText(rawNextSteps[0])
    || 'Open the dossier and review the buyer hypothesis.';
  const conciseSupportingSignals = conciseList([
    ...findingTexts,
    ...(Array.isArray(opp.supporting_signals) ? opp.supporting_signals : []),
  ], 4);
  const conciseReadMoreContext = conciseText(opp.read_more_context, 360) || conciseText(opp.description, 360);
  const conciseWhy = conciseText(opp.why_this_is_an_opportunity, 320) || conciseText(opp.description, 320) || 'No description available';
  const capabilityMatch = conciseText(ypFitBreakdown.capability_match, 220);
  const buyerRoute = conciseText(ypFitBreakdown.buyer_route, 220);
  const outreachAngle = conciseText(ypFitBreakdown.outreach_angle, 260);
  const verificationCaveat = conciseText(ypFitBreakdown.verification_needed, 240)
    || 'Verify recency, source evidence, and buyer ownership before outreach.';
  const briefingTitle = briefing.signal_title || formatSpecificSignalTitle(organization, opp.title || organization, conciseSupportingSignals, taxonomy.opportunity_kind || 'Opportunity signal');
  const signalCategory = formatSignalCategory(briefingTitle, taxonomy.opportunity_kind || 'Signal');
  const isDoncasterRecruitment = isDoncasterRecruitmentSignal(briefingTitle);
  const decisionSummary = briefing.decision_summary || '';
  const triggerText = briefing.what_happened || briefing.trigger || (isDoncasterRecruitment
    ? 'Doncaster Rovers appear to be hiring for a Recruitment Analyst role, suggesting active investment in recruitment operations and data-led player identification.'
    : conciseBlockText(temporalReasoning?.reason, 340)
    || conciseBlockText(conciseSupportingSignals[0], 340)
    || conciseWhy);
  const whyItMattersBrief = briefing.why_it_matters_now || briefing.why_it_matters || (isDoncasterRecruitment
    ? 'A live football operations hire is more actionable than static club context. It may indicate budget, urgency, or a push around scouting workflows, academy pathways, and player intelligence.'
    : conciseWhy);
  const ypAngle = briefing.yellow_panther_angle || (isDoncasterRecruitment
    ? 'Position Yellow Panther around practical recruitment intelligence: turning player, club, market, and pathway data into usable decision support for football operations teams.'
    : capabilityMatch
    ? `Position Yellow Panther around ${capabilityMatch}.`
    : conciseBlockText(opp.yp_fit_reasoning, 280) || 'Position Yellow Panther around practical decision support tied to the live signal.');
  const routeText = briefing.suggested_route || (isDoncasterRecruitment && buyerRoute
    ? `${buyerRoute} is a possible commercial entry point, but the true buyer may sit in recruitment, academy, or football operations.`
    : buyerRoute
    ? `${buyerRoute}${/buyer|owner|verify|checking/i.test(buyerRoute) ? '' : ' — possible route; buyer ownership needs checking.'}`
    : 'Buyer route unconfirmed; identify the owner before outreach.');
  const nextMove = briefing.next_move || (isDoncasterRecruitment
    ? 'Verify the job source, date, hiring owner, and whether the vacancy is still active. If confirmed, use the hiring signal as a soft outreach wedge.'
    : `Verify the source, date, hiring owner, and whether the signal is still active. If confirmed, use it as a soft outreach wedge.`);
  const checkBeforeOutreach = formatVerifyBeforeAction(briefing.verify_before_action) || (isDoncasterRecruitment
    ? 'Confirm the role is still live, the source is official or recent, and whether ownership sits in recruitment, academy, football operations, or commercial.'
    : verificationCaveat);
  const signalStrength = briefing.signal_strength || formatSignalStrength(fit, confidence, temporalReasoning?.status || 'unknown');
  const outreachOpener = briefing.outreach_opener || (isDoncasterRecruitment
    ? 'Noticed Doncaster are hiring around recruitment analysis. We help clubs turn recruitment and market signals into practical intelligence for scouting, academy planning, and decision-making.'
    : formatOutreachOpener(triggerText, ypAngle, routeText));
  const approachStrategy = outreachAngle
    || recommendedAction
    || 'Use the signal as a hypothesis, then validate the buyer route before outreach.';
  const successRationale = conciseText(ypFitBreakdown.success_rationale, 260)
    || (capabilityMatch
      ? `This makes sense for Yellow Panther because the signal maps to ${capabilityMatch}.`
      : 'This makes sense for Yellow Panther only if the signal maps to a funded commercial or operational priority.');
  const strategyNextSteps = conciseBlockText([
    approachStrategy,
    buyerRoute ? `Buyer route: ${buyerRoute}.` : '',
    `Check before outreach: ${verificationCaveat}`,
  ].filter(Boolean).join(' '), 520);

  return {
    id: opp.id,
    title: opp.title || organization,
    briefingTitle,
    signalCategory,
    opportunityKind: taxonomy.opportunity_kind || 'Other',
    organization,
    sport: displayTaxonomy.sport,
    competition: displayTaxonomy.competition,
    entityRole: displayTaxonomy.entity_role,
    country: opp.location || 'Unknown',
    theme: displayTaxonomy.theme,
    deadline: opp.deadline || undefined,
    value: opp.value || undefined,
    description: conciseWhy,
    whyItMatters: whyItMattersBrief,
    fitFeedback: conciseBlockText(opp.yp_fit_reasoning) || conciseBlockText(opp.yellow_panther_fit_feedback) || 'Yellow Panther fit is inferred from the dossier evidence and fit score.',
    suggestedAction: recommendedAction,
    nextSteps: recommendedAction,
    supportingSignals: conciseSupportingSignals,
    signalSummary: conciseSupportingSignals.join(' · '),
    readMoreContext: conciseReadMoreContext,
    lastUpdated: opp.detected_at || 'Unknown',
    temporalReasoning,
    patternReasoning,
    ypFitReasoning: ypAngle,
    recommendedAction,
    approachStrategy,
    successRationale,
    verificationCaveat,
    strategyNextSteps,
    signalStrength,
    verificationStatus: briefing.verification_status || formatVerificationStatus(opp.status || ''),
    triggerText,
    patternConfidence: formatPatternConfidence(patternReasoning),
    routeText,
    nextMove,
    outreachOpener,
    checkBeforeOutreach,
    decisionSummary,
    findings,
    timeline,
    relatedPatterns,
    temporalStatus: temporalReasoning?.status || 'unknown',
    signalType: patternReasoning?.signal_type || 'market',
    criticalOpportunityScore: Math.round(fit / 10),
    priorityScore: Math.max(0, Math.round(priority)),
    trustScore: Math.max(0, Math.round(confidence / 10)),
    influenceScore: Math.max(0, Math.round((fit + confidence) / 20)),
    poiScore: Math.max(0, Math.round((fit + priority) / 20)),
    vectorSimilarity: Math.max(0, Math.min(1, fit / 100)),
    ypRelevance: Number(opp.yp_relevance ?? fit),
    commercialConfidence: opp.commercial_confidence || 'High',
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
  const focusedEntityId = searchParams?.get('entityId') || '';
  const focusedEntityName = searchParams?.get('entityName') || '';
  const reviewMode = searchParams?.get('mode') === 'review';

  const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<ReviewableDossierCandidate[]>([]);
  const [reviewCandidateCount, setReviewCandidateCount] = useState(0);
  const [verifyNowRecommendations, setVerifyNowRecommendations] = useState<ReviewableDossierCandidate[]>([]);
  const [verifyNowCount, setVerifyNowCount] = useState(0);
  const [commercialStateCounts, setCommercialStateCounts] = useState<Record<CommercialStateTab, number>>({
    outreach_ready: 0,
    verify_now: 0,
    watch: 0,
    context_only: 0,
    data_issue: 0,
  });
  const [commercialStateCards, setCommercialStateCards] = useState<Record<CommercialStateTab, ReviewableDossierCandidate[]>>({
    outreach_ready: [],
    verify_now: [],
    watch: [],
    context_only: [],
    data_issue: [],
  });
  const [selectedCommercialStateTab, setSelectedCommercialStateTab] = useState<CommercialStateTab>('watch');
  const [commercialStatePage, setCommercialStatePage] = useState(1);
  const [commercialStateSort, setCommercialStateSort] = useState<CommercialSort>('freshest');
  const [commercialStatePagination, setCommercialStatePagination] = useState({
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  });
  const [searchQuery, setSearchQuery] = useState(focusedEntityName);
  const [sportFilter, setSportFilter] = useState('all');
  const [competitionFilter, setCompetitionFilter] = useState('all');
  const [entityRoleFilter, setEntityRoleFilter] = useState('all');
  const [opportunityKindFilter, setOpportunityKindFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [temporalStatusFilter, setTemporalStatusFilter] = useState('all');
  const [signalTypeFilter, setSignalTypeFilter] = useState('all');
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

        const payload = await response.json() as GraphitiOpportunityResponse;
        const mapped = Array.isArray(payload?.opportunities)
          ? payload.opportunities.map(normalizeOpportunity)
          : [];

        setOpportunities(mapped);

        const diagnosticsParams = new URLSearchParams({
          commercial_state: selectedCommercialStateTab,
          commercial_page: String(commercialStatePage),
          commercial_page_size: '24',
          commercial_sort: commercialStateSort,
        });
        const diagnosticsResponse = await fetch(`/api/opportunities/diagnostics?${diagnosticsParams.toString()}`, {
          cache: 'no-store',
        });

        if (!diagnosticsResponse.ok) {
          throw new Error(`Failed to load opportunity diagnostics (${diagnosticsResponse.status})`);
        }

        const diagnosticsPayload = await diagnosticsResponse.json() as OpportunityDiagnosticsResponse;
        setVerifyNowRecommendations(Array.isArray(diagnosticsPayload.verify_now_recommendations)
          ? diagnosticsPayload.verify_now_recommendations
          : []);
        setVerifyNowCount(Number(diagnosticsPayload.verify_now_count || 0));
        setCommercialStateCounts({
          outreach_ready: Number(diagnosticsPayload.commercial_state_counts?.outreach_ready || 0),
          verify_now: Number(diagnosticsPayload.commercial_state_counts?.verify_now || 0),
          watch: Number(diagnosticsPayload.commercial_state_counts?.watch || 0),
          context_only: Number(diagnosticsPayload.commercial_state_counts?.context_only || 0),
          data_issue: Number(diagnosticsPayload.commercial_state_counts?.data_issue || 0),
        });
        setCommercialStateCards({
          outreach_ready: Array.isArray(diagnosticsPayload.commercial_state_cards?.outreach_ready) ? diagnosticsPayload.commercial_state_cards.outreach_ready : [],
          verify_now: Array.isArray(diagnosticsPayload.commercial_state_cards?.verify_now) ? diagnosticsPayload.commercial_state_cards.verify_now : [],
          watch: Array.isArray(diagnosticsPayload.commercial_state_cards?.watch) ? diagnosticsPayload.commercial_state_cards.watch : [],
          context_only: Array.isArray(diagnosticsPayload.commercial_state_cards?.context_only) ? diagnosticsPayload.commercial_state_cards.context_only : [],
          data_issue: Array.isArray(diagnosticsPayload.commercial_state_cards?.data_issue) ? diagnosticsPayload.commercial_state_cards.data_issue : [],
        });
        setCommercialStatePagination({
          page: Number(diagnosticsPayload.commercial_state_pagination?.page || commercialStatePage),
          pageSize: Number(diagnosticsPayload.commercial_state_pagination?.page_size || 24),
          total: Number(diagnosticsPayload.commercial_state_pagination?.total || 0),
          totalPages: Number(diagnosticsPayload.commercial_state_pagination?.total_pages || 1),
          hasPrevious: Boolean(diagnosticsPayload.commercial_state_pagination?.has_previous),
          hasNext: Boolean(diagnosticsPayload.commercial_state_pagination?.has_next),
        });
        setReviewCandidates(reviewMode && Array.isArray(diagnosticsPayload.reviewable_dossier_candidates)
          ? diagnosticsPayload.reviewable_dossier_candidates
          : []);
        setReviewCandidateCount(reviewMode ? Number(diagnosticsPayload.reviewable_dossier_candidate_count || 0) : 0);
      } catch (error) {
        console.error('Error loading opportunities:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load opportunities');
        setOpportunities([]);
        setReviewCandidates([]);
        setReviewCandidateCount(0);
        setVerifyNowRecommendations([]);
        setVerifyNowCount(0);
        setCommercialStateCounts({ outreach_ready: 0, verify_now: 0, watch: 0, context_only: 0, data_issue: 0 });
        setCommercialStateCards({ outreach_ready: [], verify_now: [], watch: [], context_only: [], data_issue: [] });
        setCommercialStatePagination({ page: 1, pageSize: 24, total: 0, totalPages: 1, hasPrevious: false, hasNext: false });
      } finally {
        setLoading(false);
      }
    }

    void loadOpportunities();
  }, [commercialStatePage, commercialStateSort, reviewMode, selectedCommercialStateTab]);

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
    if (temporalStatusFilter !== 'all') filtered = filtered.filter((opp) => opp.temporalStatus === temporalStatusFilter);
    if (signalTypeFilter !== 'all') filtered = filtered.filter((opp) => opp.signalType === signalTypeFilter);

    if (scoreFilter !== 'all') {
      const minScore = scoreFilter === 'high' ? 8 : scoreFilter === 'medium' ? 6 : 0;
      filtered = filtered.filter((opp) => opp.criticalOpportunityScore >= minScore);
    }

    const temporalWeight = (status: string) => {
      switch (status) {
        case 'accelerating': return 5;
        case 'active': return 4;
        case 'emerging': return 3;
        case 'unknown': return 2;
        case 'stale': return 1;
        case 'expired': return 0;
        default: return 2;
      }
    };

    return filtered.sort((a, b) => {
      const temporalDelta = temporalWeight(b.temporalStatus) - temporalWeight(a.temporalStatus);
      return temporalDelta || b.criticalOpportunityScore - a.criticalOpportunityScore;
    });
  }, [competitionFilter, entityRoleFilter, focusedEntityId, focusedEntityName, opportunityKindFilter, opportunities, scoreFilter, searchQuery, signalTypeFilter, sportFilter, temporalStatusFilter, themeFilter]);

  const taxonomyFacetOptions = useMemo(() => buildOpportunityFacetOptions(opportunities), [opportunities]);
  const temporalStatusOptions = useMemo(() => {
    const statuses = [...new Set(opportunities.map((opp) => opp.temporalStatus).filter(Boolean))];
    return [
      { value: 'all', label: 'All temporal states' },
      ...statuses.map((status) => ({ value: status, label: status.charAt(0).toUpperCase() + status.slice(1) })),
    ];
  }, [opportunities]);
  const signalTypeOptions = useMemo(() => {
    const signalTypes = [...new Set(opportunities.map((opp) => opp.signalType).filter(Boolean))];
    return [
      { value: 'all', label: 'All signal types' },
      ...signalTypes.map((signalType) => ({ value: signalType, label: signalType.charAt(0).toUpperCase() + signalType.slice(1) })),
    ];
  }, [opportunities]);

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
      label: 'Signal category',
      value: opportunityKindFilter,
      placeholder: 'Signal category',
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
    {
      key: 'temporal-status',
      label: 'Temporal Status',
      value: temporalStatusFilter,
      placeholder: 'Temporal Status',
      options: temporalStatusOptions,
      onValueChange: setTemporalStatusFilter,
    },
    {
      key: 'signal-type',
      label: 'Signal Type',
      value: signalTypeFilter,
      placeholder: 'Signal Type',
      options: signalTypeOptions,
      onValueChange: setSignalTypeFilter,
    },
  ];

  const filterChips = [
    searchQuery ? { key: 'query', label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery('') } : null,
    sportFilter !== 'all' ? { key: 'sport', label: `Sport: ${sportFilter}`, onRemove: () => setSportFilter('all') } : null,
    competitionFilter !== 'all' ? { key: 'competition', label: `Competition: ${competitionFilter}`, onRemove: () => setCompetitionFilter('all') } : null,
    entityRoleFilter !== 'all' ? { key: 'entity-role', label: `Role: ${entityRoleFilter}`, onRemove: () => setEntityRoleFilter('all') } : null,
    opportunityKindFilter !== 'all' ? { key: 'opportunity-kind', label: `Signal category: ${opportunityKindFilter}`, onRemove: () => setOpportunityKindFilter('all') } : null,
    themeFilter !== 'all' ? { key: 'theme', label: `Theme: ${themeFilter}`, onRemove: () => setThemeFilter('all') } : null,
    scoreFilter !== 'all' ? { key: 'score', label: `Score: ${scoreFilter}`, onRemove: () => setScoreFilter('all') } : null,
    temporalStatusFilter !== 'all' ? { key: 'temporal-status', label: `Temporal: ${temporalStatusFilter}`, onRemove: () => setTemporalStatusFilter('all') } : null,
    signalTypeFilter !== 'all' ? { key: 'signal-type', label: `Signal: ${signalTypeFilter}`, onRemove: () => setSignalTypeFilter('all') } : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const resetFilters = () => {
    setSearchQuery('');
    setSportFilter('all');
    setCompetitionFilter('all');
    setEntityRoleFilter('all');
    setOpportunityKindFilter('all');
    setThemeFilter('all');
    setScoreFilter('all');
    setTemporalStatusFilter('all');
    setSignalTypeFilter('all');
  };

  const commercialStateTabs: Array<{ key: CommercialStateTab; label: string; description: string }> = [
    {
      key: 'outreach_ready',
      label: 'Outreach-ready',
      description: 'Use now. Current trigger, credible buyer route, usable opener, and specific Yellow Panther wedge.',
    },
    {
      key: 'verify_now',
      label: 'Verify now',
      description: 'Good commercial hypothesis, but source, buyer, or scope needs checking before outreach.',
    },
    {
      key: 'watch',
      label: 'Watch',
      description: 'Interesting but not actionable yet. Needs fresher evidence, a clearer buyer, or a stronger Yellow Panther wedge.',
    },
    {
      key: 'context_only',
      label: 'Context only',
      description: 'Useful background, but no current commercial trigger.',
    },
    {
      key: 'data_issue',
      label: 'Data issues',
      description: 'Entity mismatch, broken extraction, missing evidence, or internal pipeline leakage.',
    },
  ];
  const commercialStateCardsByTab = commercialStateCards[selectedCommercialStateTab] || [];
  const selectedCommercialState = commercialStateTabs.find((tab) => tab.key === selectedCommercialStateTab) || commercialStateTabs[1];
  const selectCommercialStateTab = (tab: CommercialStateTab) => {
    setSelectedCommercialStateTab(tab);
    setCommercialStatePage(1);
  };
  const sortCommercialStateCards = (sort: CommercialSort) => {
    setCommercialStateSort(sort);
    setCommercialStatePage(1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getOpportunityKindColor = (kind: string) => {
    switch (kind) {
      case 'Hiring':
        return 'bg-emerald-500';
      case 'Opportunity':
        return 'bg-emerald-500';
      case 'Watch item':
        return 'bg-blue-500';
      case 'Operational':
        return 'bg-slate-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTemporalStatusColor = (status: string) => {
    switch (status) {
      case 'accelerating':
        return 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100';
      case 'active':
        return 'border-green-300/60 bg-green-400/15 text-green-100';
      case 'emerging':
        return 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100';
      case 'stale':
        return 'border-amber-300/60 bg-amber-400/15 text-amber-100';
      case 'expired':
        return 'border-red-300/60 bg-red-400/15 text-red-100';
      default:
        return 'border-slate-300/40 bg-slate-400/10 text-slate-100';
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant={reviewMode ? 'default' : 'outline'} size="sm">
              <Link href="/opportunities?mode=review">Review candidates</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/opportunities">Strict shortlist</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/entity-browser">Open dossier workspace</Link>
            </Button>
          </div>
        }
      />
      <AppPageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Outreach-ready</div>
            <div className="mt-2 text-3xl font-semibold text-white">{filteredOpportunities.length}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">To verify</div>
            <div className="mt-2 text-3xl font-semibold text-cyan-300">{verifyNowCount}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Watch</div>
            <div className="mt-2 text-3xl font-semibold text-blue-300">{commercialStateCounts.watch}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Context only</div>
            <div className="mt-2 text-3xl font-semibold text-slate-200">{commercialStateCounts.context_only}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-custom-border bg-custom-bg/60 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-fm-medium-grey">Data issues</div>
            <div className="mt-2 text-3xl font-semibold text-rose-300">{commercialStateCounts.data_issue}</div>
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
              {filteredOpportunities.length} of {opportunities.length} outreach-ready · {verifyNowCount} to verify
            </div>
          )}
        />

        {loadError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {loadError}
          </div>
        )}

        {reviewMode && (
          <section className={OPPORTUNITY_SURFACE_CLASS}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Diagnostics review mode</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Reviewable dossier candidates</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">
                  Complete and partial dossier rows that did not make the strict shortlist. They are ranked by proximity to promotion and keep explicit blocker labels so this view does not dilute the active shortlist.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-500 text-slate-100">
                {reviewCandidates.length} shown of {reviewCandidateCount}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {reviewCandidates.slice(0, 12).map((candidate) => (
                <div key={candidate.opportunity_id} className={OPPORTUNITY_CARD_CLASS}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{candidate.title || candidate.entity_name || 'Untitled dossier candidate'}</h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span>{candidate.entity_name || 'Unknown entity'}</span>
                        <span>quality_state: {candidate.quality_state || 'unknown'}</span>
                        <span>commercial: {candidate.commercial_status || 'unknown'}</span>
                        <span>temporal: {candidate.temporal_status || 'unknown'}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-yellow-300/40 text-yellow-100">
                      score {candidate.promotion_score || 0}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(candidate.promotion_blockers || ['No blocker label available']).slice(0, 4).map((blocker) => (
                      <Badge key={`${candidate.opportunity_id}-${blocker}`} variant="outline" className="border-slate-500 text-slate-100">
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span>YP fit: {candidate.yellow_panther_fit ?? 0}%</span>
                    {candidate.dossier_url ? (
                      <Link href={candidate.dossier_url} className="text-sky-100 underline decoration-sky-200/40 underline-offset-2">
                        Open dossier
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={OPPORTUNITY_SURFACE_CLASS}>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Commercial state</div>
              <h2 className="mt-1 text-xl font-semibold text-white">Research feed</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                Signals worth reviewing, but not yet approved for outreach. Only cards with a current trigger, relevant sports buyer, and plausible YP route are promoted to the active shortlist.
              </p>
            </div>
            <Badge variant="outline" className="border-slate-300/40 text-slate-100">
              {commercialStateCounts.outreach_ready} ready · {commercialStateCounts.verify_now} verify · {commercialStateCounts.watch} watch · {commercialStateCounts.context_only} context · {commercialStateCounts.data_issue} issues
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {commercialStateTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectCommercialStateTab(tab.key)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedCommercialStateTab === tab.key
                    ? 'border-yellow-300 bg-yellow-300/15 text-yellow-50'
                    : 'border-slate-300/20 bg-black/20 text-slate-300 hover:border-slate-200/40'
                }`}
              >
                {tab.label} ({commercialStateCounts[tab.key]})
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-300">{selectedCommercialState.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: 'freshest' as const, label: 'Freshest' },
              { key: 'yp_fit' as const, label: 'Highest YP fit' },
              { key: 'evidence' as const, label: 'Most evidence' },
            ].map((sort) => (
              <button
                key={sort.key}
                type="button"
                onClick={() => sortCommercialStateCards(sort.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  commercialStateSort === sort.key
                    ? 'border-cyan-300 bg-cyan-300/15 text-cyan-50'
                    : 'border-slate-300/20 bg-black/20 text-slate-300 hover:border-slate-200/40'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-700 bg-[#14233a] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-300">
              Page {commercialStatePage} of {commercialStatePagination.totalPages} · showing {commercialStateCardsByTab.length} of {commercialStatePagination.total} {selectedCommercialState.label.toLowerCase()} cards
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!commercialStatePagination.hasPrevious}
                onClick={() => setCommercialStatePage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!commercialStatePagination.hasNext}
                onClick={() => setCommercialStatePage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {commercialStateCardsByTab.map((card) => (
              <div key={`${selectedCommercialStateTab}-${card.opportunity_id}`} className={OPPORTUNITY_CARD_CLASS}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-300/30 text-slate-100">
                        {card.is_active ? 'Outreach-ready' : 'Not shortlist'}
                      </Badge>
                      <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                        {card.commercial_state || card.commercial_status || selectedCommercialStateTab}
                      </Badge>
                      <Badge variant="outline" className="border-amber-300/30 text-amber-100">
                        {normalizeBriefVerdictLabel(card.bd_brief?.brief_verdict)}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{card.bd_brief?.signal_title || card.title || card.entity_name || 'Untitled commercial-state card'}</h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span>{card.entity_name || 'Unknown entity'}</span>
                      <span>temporal: {card.temporal_status || 'unknown'}</span>
                      <span>quality: {card.quality_state || 'unknown'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-yellow-300/40 text-yellow-100">
                    YP relevance {card.yp_relevance ?? card.yellow_panther_fit ?? 0}%
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                  <span>Status: {card.commercial_state || selectedCommercialStateTab}</span>
                  <span>Signal: {formatCommercialStateSignalLabel(card)}</span>
                  <span>Freshness: {card.temporal_status || 'unknown'}</span>
                  <span>Commercial confidence: {card.commercial_confidence || 'Low'}</span>
                </div>

                {card.bd_brief?.decision_summary ? (
                  <div className={OPPORTUNITY_ACCENT_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-100/70">Decision summary</div>
                    {renderBriefText(card.bd_brief.decision_summary, 'mt-1 text-sm text-emerald-50')}
                  </div>
                ) : null}

                <div className={`mt-3 ${OPPORTUNITY_PANEL_CLASS}`}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">What changed</div>
                  {renderBriefText(card.bd_brief?.what_happened || card.bd_brief?.trigger || card.bd_brief?.what_changed || card.title || 'Materialized commercial signal needs review.')}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Why it matters</div>
                    {renderBriefText(card.bd_brief?.why_it_matters_now || card.bd_brief?.why_it_matters || 'This needs validation before it becomes an outreach-ready opportunity.')}
                  </div>
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Yellow Panther angle</div>
                    {renderBriefText(card.bd_brief?.yellow_panther_angle || 'Map this signal to a practical Yellow Panther decision-support use case.')}
                  </div>
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Suggested route</div>
                    {renderBriefText(card.bd_brief?.suggested_route || 'Buyer route unconfirmed; identify the right owner before outreach.')}
                  </div>
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Verify before action</div>
                    {renderBriefText(formatVerifyBeforeAction(card.bd_brief?.verify_before_action) || card.suggested_verification_action || 'Check recency, source quality, and buyer ownership.')}
                  </div>
                </div>

                <div className={`mt-3 ${OPPORTUNITY_ACCENT_PANEL_CLASS}`}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-sky-100/70">Outreach opener</div>
                  {renderBriefText(card.bd_brief?.outreach_opener || card.bd_brief?.outreach_hypothesis || 'Use this as a soft research hypothesis only after verifying the trigger and buyer.', 'mt-1 text-sm text-sky-50')}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(card.promotion_blockers || ['Labelled for review']).slice(0, 4).map((blocker) => (
                    <Badge key={`${card.opportunity_id}-${blocker}`} variant="outline" className="border-slate-300/20 text-slate-200">
                      {blocker}
                    </Badge>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{card.useful_fact_count ?? 0} useful facts · {card.evidence_count ?? 0} evidence URLs · commercial confidence {card.commercial_confidence || 'Low'}</span>
                  {card.dossier_url ? (
                    <Link href={card.dossier_url} className="text-cyan-100 underline decoration-cyan-200/40 underline-offset-2">
                      Open dossier
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {commercialStateCardsByTab.length === 0 && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-[#14233a] p-4 text-sm text-slate-300">
              No cards are currently available for {selectedCommercialState.label}.
            </div>
          )}
        </section>

        <section className={OPPORTUNITY_SURFACE_CLASS}>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-200">Outreach-ready</div>
              <h2 className="mt-1 text-xl font-semibold text-white">Strict active shortlist</h2>
              <p className="mt-1 max-w-3xl text-sm text-fm-medium-grey">
                Only promoted Graphiti rows with a current trigger, clean evidence, specific YP wedge, plausible buyer route, and usable opener appear here.
              </p>
            </div>
            <Badge variant="outline" className="border-yellow-300/40 text-yellow-100">
              {filteredOpportunities.length} outreach-ready
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredOpportunities.map((opportunity) => (
            <div
              key={opportunity.id}
                  className={`${OPPORTUNITY_CARD_CLASS} min-w-0 transition-colors hover:border-slate-500`}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="break-words text-xl font-semibold leading-tight text-white">{opportunity.briefingTitle}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fm-medium-grey">
                    <Badge variant="outline" className="border-emerald-300/40 text-emerald-100 text-xs">
                      {opportunity.signalStrength} signal
                    </Badge>
                    <Badge variant="outline" className="border-yellow-300/40 text-yellow-100 text-xs">
                      YP relevance {opportunity.ypRelevance}%
                    </Badge>
                    <Badge variant="outline" className="border-cyan-300/40 text-cyan-100 text-xs">
                      Commercial confidence {opportunity.commercialConfidence}
                    </Badge>
                    <Badge variant="outline" className={`${getTemporalStatusColor(opportunity.temporalStatus)} text-xs`}>
                      {opportunity.verificationStatus}
                    </Badge>
                    <Badge variant="secondary" className={`${getOpportunityKindColor(opportunity.signalCategory)} text-white text-xs`}>
                      {opportunity.signalCategory}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-fm-light-grey">
                    <span className="font-medium text-fm-medium-grey">Club context:</span>{' '}
                    {getCanonicalContext([opportunity.sport, opportunity.country, opportunity.competition, opportunity.entityRole])}
                  </div>
                </div>
                <div className="text-xs text-fm-medium-grey">
                  Updated: {opportunity.lastUpdated}
                </div>
              </div>

              <div className="mb-4 grid gap-3">
                {opportunity.decisionSummary ? (
                    <div className={OPPORTUNITY_ACCENT_PANEL_CLASS}>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-100/80">Decision summary</div>
                      {renderBriefText(opportunity.decisionSummary, 'mt-1 text-sm text-emerald-50')}
                    </div>
                  ) : null}
                <div className={OPPORTUNITY_PANEL_CLASS}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Trigger</div>
                  {renderBriefText(opportunity.triggerText, 'mt-1 text-sm text-white')}
                </div>
                <div className={OPPORTUNITY_PANEL_CLASS}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Why it matters</div>
                  {renderBriefText(opportunity.whyItMatters, 'mt-1 text-sm text-white')}
                </div>
                <div className={OPPORTUNITY_PANEL_CLASS}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Yellow Panther angle</div>
                  {renderBriefText(opportunity.ypFitReasoning, 'mt-1 text-sm text-white')}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Suggested route</div>
                    {renderBriefText(opportunity.routeText, 'mt-1 text-sm text-white')}
                  </div>
                  <div className={OPPORTUNITY_PANEL_CLASS}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Check before outreach</div>
                    {renderBriefText(opportunity.checkBeforeOutreach, 'mt-1 text-sm text-white')}
                  </div>
                </div>
                <div className={OPPORTUNITY_ACCENT_PANEL_CLASS}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-yellow-100/80">Next move</div>
                  {renderBriefText(opportunity.nextMove, 'mt-1 text-sm text-yellow-50')}
                </div>
                <div className={OPPORTUNITY_PANEL_CLASS}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Outreach opener</div>
                  {renderBriefText(opportunity.outreachOpener, 'mt-1 text-sm text-white')}
                </div>
              </div>

              {openOpportunityId === opportunity.id && (
                <div className="mb-4 rounded-lg border border-slate-700 bg-[#101a2b] p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-fm-medium-grey">Read more</div>
                  <div className="mt-2 grid gap-3 text-sm text-white sm:grid-cols-2">
                    <div>
                      <div className="font-medium text-yellow-100">What to look for</div>
                        {renderBriefText(opportunity.readMoreContext || 'Review the dossier for the supporting evidence, decision owners, and commercial signal details.', 'mt-1 text-fm-light-grey')}
                      {opportunity.supportingSignals.length > 0 && (
                        <ul className="mt-3 space-y-1 text-fm-light-grey">
                          {opportunity.supportingSignals.slice(0, 4).map((signal) => (
                            <li key={`${opportunity.id}-${signal}`} className="flex gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-300" />
                              <span>{signal}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-yellow-100">What to do next</div>
                      {renderBriefText(opportunity.strategyNextSteps, 'mt-1 text-fm-light-grey')}
                      <div className="mt-3 font-medium text-yellow-100">Pattern confidence</div>
                      {renderBriefText(opportunity.patternConfidence, 'mt-1 text-fm-light-grey')}
                    </div>
                  </div>
                  {opportunity.timeline.length > 0 && (
                    <div className={`mt-4 ${OPPORTUNITY_PANEL_CLASS}`}>
                      <div className="font-medium text-yellow-100">Temporal timeline</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-fm-light-grey">
                        {opportunity.timeline.slice(0, 5).map((event) => (
                          <span key={`${opportunity.id}-${event.at}-${event.label}`} className="rounded-full border border-custom-border bg-black/20 px-2 py-1">
                            {event.at}: {event.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {opportunity.findings.length > 0 && (
                    <div className={`mt-4 ${OPPORTUNITY_PANEL_CLASS}`}>
                      <div className="font-medium text-yellow-100">Graphiti findings</div>
                      <ul className="mt-2 space-y-2 text-sm text-fm-light-grey">
                        {opportunity.findings.slice(0, 5).map((finding, index) => (
                          <li key={`${opportunity.id}-finding-${index}`} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-yellow-300" />
                            <span>
                              {finding.source_url ? (
                                <a href={finding.source_url} className="text-yellow-100 underline decoration-yellow-300/40 underline-offset-2">
                                  {finding.finding}
                                </a>
                              ) : finding.finding}
                              {finding.observed_at ? <span className="text-fm-medium-grey"> ({finding.observed_at})</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {opportunity.relatedPatterns.length > 0 && (
                    <div className={`mt-4 ${OPPORTUNITY_PANEL_CLASS}`}>
                      <div className="font-medium text-yellow-100">Related pattern cluster</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {opportunity.relatedPatterns.slice(0, 4).map((pattern, index) => (
                          <Badge key={`${opportunity.id}-pattern-${index}`} variant="outline" className="border-custom-border text-fm-light-grey">
                            {pattern.entity_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
        </section>

        {verifyNowRecommendations.length > 0 && (
          <section className={OPPORTUNITY_SURFACE_CLASS}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Verify now</div>
                <h2 className="mt-1 text-xl font-semibold text-white">Recommendations needing verification</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">
                  Strong dossier-backed recommendations that need source, trigger, or buyer verification before outreach.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-500 text-slate-100">
                {verifyNowRecommendations.length} shown of {verifyNowCount} to verify
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {verifyNowRecommendations.map((recommendation) => (
                <div key={recommendation.opportunity_id} className={OPPORTUNITY_CARD_CLASS}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-cyan-200/40 text-cyan-100">
                          {recommendation.recommendation_tier || 'verify_now'}
                        </Badge>
                        <Badge variant="outline" className="border-yellow-300/40 text-yellow-100">
                          YP fit {recommendation.yellow_panther_fit ?? 0}%
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-white">{conciseRecommendationTitle(recommendation)}</h3>
                      {recommendation.title && recommendation.title !== conciseRecommendationTitle(recommendation) ? (
                        <div className="mt-2 rounded-md border border-slate-700 bg-[#101a2b] p-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Signal detail</div>
                          {renderBriefText(recommendation.title, 'mt-1 text-sm text-slate-100')}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span>{recommendation.entity_name || 'Unknown entity'}</span>
                        <span>commercial: {recommendation.commercial_status || 'unknown'}</span>
                        <span>temporal: {recommendation.temporal_status || 'unknown'}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-300/40 text-emerald-100">
                      score {recommendation.promotion_score || 0}
                    </Badge>
                  </div>

                  <div className="mt-3 rounded-md border border-slate-700 bg-[#101a2b] p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Verification action</div>
                    {renderBriefText(recommendation.suggested_verification_action || 'Verify source recency, buyer ownership, and whether the signal is active enough for outreach.')}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(recommendation.promotion_blockers || ['Below active shortlist threshold']).slice(0, 4).map((blocker) => (
                      <Badge key={`${recommendation.opportunity_id}-${blocker}`} variant="outline" className="border-slate-500 text-slate-100">
                        {blocker}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span>{recommendation.useful_fact_count ?? 0} useful facts · {recommendation.evidence_count ?? 0} evidence URLs</span>
                    {recommendation.dossier_url ? (
                      <Link href={recommendation.dossier_url} className="text-sky-100 underline decoration-sky-200/40 underline-offset-2">
                        Open dossier
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
