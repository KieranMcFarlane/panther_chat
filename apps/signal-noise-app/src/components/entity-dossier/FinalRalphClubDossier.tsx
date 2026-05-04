"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  BarChart3,
  Brain,
  Building,
  CheckCircle,
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Target,
  Users,
  Zap,
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'
import { buildDossierTabs } from '@/lib/dossier-tabs'
import {
  buildRecommendedApproachText,
  buildYellowPantherOpportunityText,
} from '@/lib/dossier-display-artifacts'

interface FinalRalphClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier: any
}

function valueOrFallback(value: any, fallback: string) {
  const formatted = formatValue(value)
  return formatted || fallback
}

function buildFallbackCoreInfo(entity: Entity) {
  const props = entity.properties || {}
  return {
    name: props.name || entity.properties?.name || 'Club',
    type: props.type || 'Club',
    league: props.league || props.level || props.league_name || 'Unknown',
    founded: props.founded || props.founded_year || props.year_founded || 'Unknown',
    hq: props.headquarters || props.hq || props.country || 'Unknown',
    stadium: props.stadium || props.venue || 'Unknown',
    website: props.website || 'No website available',
    employee_range: props.employee_range || props.company_size || 'Unknown',
  }
}

function buildFallbackStrategicSummary(dossier: any, questionFirst: any) {
  const answers = Array.isArray(questionFirst?.answers) ? questionFirst.answers : []
  const firstValidAnswer = answers.find((answer: any) =>
    Boolean(answer?.answer?.summary || answer?.answer?.value || answer?.terminal_summary),
  )

  const answerSummary = firstValidAnswer?.answer?.summary
    || firstValidAnswer?.answer?.value
    || firstValidAnswer?.terminal_summary
    || null

  return {
    overall_assessment:
      dossier?.quality_summary
      || questionFirst?.quality_summary
      || (questionFirst?.questions_answered
        ? `${questionFirst.questions_answered} question-first answers available for promotion`
        : 'Assessment not yet available'),
    recommended_approach:
      questionFirst?.discovery_summary?.recommended_approach
      || questionFirst?.discovery_summary?.next_best_action
      || answerSummary
      || 'Review the question-first answers and continue enrichment',
    opportunity_scoring: {
      immediate_launch: Array.isArray(questionFirst?.discovery_summary?.opportunity_signals)
        ? questionFirst.discovery_summary.opportunity_signals.map((entry: any) => ({
            opportunity: entry?.answer || entry?.question_text || entry?.candidate_id || 'Promoted signal',
            score: Number(entry?.score || entry?.confidence || 0),
          }))
        : [],
      medium_term_partnerships: [],
      long_term_initiatives: [],
    },
  }
}

function renderBulletList(items: any[], emptyLabel: string) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${index}-${String(item)}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
          <span className="text-sm text-slate-700">{String(item)}</span>
        </div>
      ))}
    </div>
  )
}

function getQuestionBucket(item: any) {
  const questionId = valueOrFallback(item?.question_id, '').toLowerCase()
  const signalType = valueOrFallback(item?.signal_type, '').toLowerCase()

  if (['q2_digital_stack', 'q4_performance', 'q5_league_context'].includes(questionId) || ['digital_stack', 'performance', 'league_context'].includes(signalType)) {
    return 'digital-stack'
  }
  if (['q7_procurement_signal', 'q8_explicit_rfp', 'q9_news_signal', 'q10_hiring_signal'].includes(questionId) || ['procurement_signal', 'tender_docs', 'news_signal', 'hiring_signal', 'launch_signal'].includes(signalType)) {
    return 'procurement-ecosystem'
  }
  if (['q3_leadership', 'q11_decision_owner', 'q12_connections', 'q14_yp_fit', 'q15_outreach_strategy'].includes(questionId) || ['leadership', 'decision_owner', 'poi', 'connections', 'yp_fit', 'outreach_strategy'].includes(signalType)) {
    return 'decision-owners-pois'
  }
  return 'evidence-sources'
}

function getQuestionTitle(item: any, index: number) {
  return valueOrFallback(item?.question_text || item?.question, '') || valueOrFallback(item?.question_id, `Question ${index + 1}`)
}

function getQuestionStatusLabel(item: any) {
  const state = valueOrFallback(item?.terminal_state || item?.validation_state, '').toLowerCase()
  if (state === 'answered' || state === 'validated' || state === 'provisional') return 'Answered'
  if (state === 'blocked') return 'Blocked'
  if (state === 'skipped') return 'Skipped'
  if (state === 'failed') return 'Failed'
  return 'No signal'
}

function getQuestionStatusClasses(item: any) {
  const state = valueOrFallback(item?.terminal_state || item?.validation_state, '').toLowerCase()
  if (state === 'answered' || state === 'validated' || state === 'provisional') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700'
  }
  if (state === 'blocked') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-700'
  }
  if (state === 'skipped') {
    return 'border-slate-400/40 bg-slate-500/10 text-slate-700'
  }
  if (state === 'failed') {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-700'
  }
  return 'border-slate-300 bg-slate-100 text-slate-700'
}

function getQuestionAnswerText(item: any) {
  const answer = item?.question_first_answer?.answer || item?.answer || {}
  const rawStructured = answer?.raw_structured_output || {}
  return valueOrFallback(
    answer?.summary ||
      answer?.value ||
      rawStructured?.answer ||
      rawStructured?.summary ||
      rawStructured?.context ||
      item?.terminal_summary ||
      item?.notes,
    '',
  )
}

function getQuestionSourceList(item: any) {
  const answer = item?.question_first_answer?.answer || item?.answer || {}
  const rawStructured = answer?.raw_structured_output || {}
  const urls = Array.isArray(rawStructured.sources) ? rawStructured.sources : []
  const refs = Array.isArray(item?.question_first_answer?.evidence_refs) ? item.question_first_answer.evidence_refs : []
  return [...urls, ...refs].filter(Boolean)
}

function renderQuestionCards(items: any[], emptyLabel: string) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const body = getQuestionAnswerText(item)
        const sources = getQuestionSourceList(item).slice(0, 4)
        const questionTitle = getQuestionTitle(item, index)
        return (
          <div key={`${valueOrFallback(item?.question_id, questionTitle)}-${index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{questionTitle}</p>
              <Badge className={getQuestionStatusClasses(item)} variant="outline">{getQuestionStatusLabel(item)}</Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {body || 'No validated answer was produced for this question.'}
            </p>
            {sources.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
                {sources.map((source: any) => (
                  <div key={String(source)} className="block truncate text-xs text-sky-300 underline underline-offset-2">
                    {String(source)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function FinalRalphClubDossier({ entity, onEmailEntity, dossier }: FinalRalphClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const props = entity.properties
  const priority = getEntityPriority(entity)
  const tabs = useMemo(() => buildDossierTabs(dossier, { entityType: valueOrFallback(props.type, 'Club') }), [dossier, props.type])

  const questionFirst = dossier?.question_first || {}
  const coreInfo = dossier?.core_info || buildFallbackCoreInfo(entity)
  const digital = dossier?.digital_transformation || {}
  const strategic = dossier?.strategic_analysis || buildFallbackStrategicSummary(dossier, questionFirst)
  const timingAnalysis = dossier?.timing_analysis || {}
  const connectionsSummary = dossier?.connections_summary || {}
  const roadmap = dossier?.implementation_roadmap || {}
  const discoverySummary = dossier?.question_first?.discovery_summary || {}
  const dossierPromotions = Array.isArray(dossier?.question_first?.dossier_promotions) ? dossier.question_first.dossier_promotions : []
  const questionRecords = Array.isArray(dossier?.questions)
    ? dossier.questions
    : Array.isArray(dossier?.answers)
      ? dossier.answers
      : []
  const digitalStackQuestions = questionRecords.filter((item: any) => getQuestionBucket(item) === 'digital-stack')
  const procurementQuestions = questionRecords.filter((item: any) => getQuestionBucket(item) === 'procurement-ecosystem')
  const decisionOwnerQuestions = questionRecords.filter((item: any) => getQuestionBucket(item) === 'decision-owners-pois')
  const evidenceQuestions = questionRecords.filter((item: any) => getQuestionBucket(item) === 'evidence-sources')
  const metadata = dossier?.metadata || {}
  const opportunities = strategic?.opportunity_scoring || {}
  const yellowPantherOpportunityText = buildYellowPantherOpportunityText(
    dossier,
    valueOrFallback(opportunities?.immediate_launch?.[0]?.opportunity, 'Opportunity not yet identified'),
  )
  const recommendedApproachText = buildRecommendedApproachText(
    dossier,
    valueOrFallback(strategic.recommended_approach, 'Begin with evidence gathering and a scoped pilot'),
  )

  const activeOpportunityList = Array.isArray(opportunities?.immediate_launch) ? opportunities.immediate_launch : []
  const promotedOpportunitySignals = Array.isArray(discoverySummary?.opportunity_signals) ? discoverySummary.opportunity_signals : []
  const promotedDecisionOwners = Array.isArray(discoverySummary?.decision_owners) ? discoverySummary.decision_owners : []
  const promotedTimingAndProcurement = Array.isArray(discoverySummary?.timing_procurement_markers)
    ? discoverySummary.timing_procurement_markers
    : Array.isArray(discoverySummary?.timing_and_procurement)
      ? discoverySummary.timing_and_procurement
      : Array.isArray(discoverySummary?.timing_markers)
        ? discoverySummary.timing_markers
        : []
  const promotedEvidenceCount = Number(discoverySummary?.supporting_evidence_count || dossierPromotions.length || 0)

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-xl font-bold text-white">
                  {String(valueOrFallback(props.name, 'A')).slice(0, 1)}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                    <Building className="h-6 w-6 text-red-600" />
                    {valueOrFallback(coreInfo.name, props.name || 'Club')}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {valueOrFallback(coreInfo.type, props.type || 'Club')}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {valueOrFallback(coreInfo.hq, props.headquarters || 'Unknown')}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      Priority {priority}/100
                    </span>
                    <Badge variant="secondary">Persisted dossier</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onEmailEntity}>
                <Mail className="mr-2 h-4 w-4" />
                Contact
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Export Dossier
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div className="text-sm font-medium text-sky-700">Dossier confidence</div>
            <div className="mt-1 text-2xl font-bold text-sky-950">
              {typeof metadata.confidence_score === 'number' ? `${Math.round(metadata.confidence_score * 100)}%` : 'n/a'}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-700">Information freshness</div>
            <div className="mt-1 text-lg font-semibold text-emerald-950">
              {valueOrFallback(metadata.information_freshness, 'Current')}
            </div>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-medium text-violet-700">Next review</div>
            <div className="mt-1 text-lg font-semibold text-violet-950">
              {valueOrFallback(metadata.next_review_date, 'Not scheduled')}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-medium text-amber-700">Roadmap phases</div>
            <div className="mt-1 text-lg font-semibold text-amber-950">
              {Object.keys(roadmap || {}).length || 0} defined
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-gray-100 p-1 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-w-0 h-auto w-full items-center gap-2 whitespace-normal break-words px-3 py-2 text-center leading-tight data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <span className="block max-w-full">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  Core Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-slate-500">Founded</div>
                  <div className="text-lg font-semibold text-slate-900">{valueOrFallback(coreInfo.founded, 'Unknown')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Stadium</div>
                  <div className="text-lg font-semibold text-slate-900">{valueOrFallback(coreInfo.stadium, 'Unknown')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Employees</div>
                  <div className="text-lg font-semibold text-slate-900">{valueOrFallback(coreInfo.employee_range, 'Unknown')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Website</div>
                  <a className="text-lg font-semibold text-blue-600 hover:underline" href={valueOrFallback(coreInfo.website, '#')} target="_blank" rel="noreferrer">
                    {valueOrFallback(coreInfo.website, 'No website')}
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Reasoner Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="text-sm font-semibold text-purple-900">Overall Assessment</div>
                  <p className="mt-1 text-sm text-purple-700">{valueOrFallback(strategic.overall_assessment, 'Assessment not yet available')}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="text-sm font-semibold text-green-900">Yellow Panther Opportunity</div>
                  <p className="mt-1 text-sm text-green-700">
                    {yellowPantherOpportunityText}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">Recommended Approach</div>
                  <p className="mt-1 text-sm text-sky-700">{recommendedApproachText}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="digital-stack" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Digital Stack
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-900">Digital posture</div>
                  <p className="mt-1 text-sm text-blue-700">
                    {valueOrFallback(digital.digital_maturity, 'n/a') !== 'n/a'
                      ? `Digital maturity ${valueOrFallback(digital.digital_maturity, 'n/a')}/100`
                      : 'Digital maturity is not yet scored in this dossier.'}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">Current partner</div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {valueOrFallback(digital.current_tech_partners?.[0], 'Not identified')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Strategic opportunities</div>
                  {renderBulletList(digital.strategic_opportunities, 'No strategic opportunities yet.')}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                  Digital stack questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderQuestionCards(digitalStackQuestions, 'No digital stack questions are available yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="procurement-ecosystem" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Procurement / Ecosystem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Evidence-backed opportunity signals</div>
                  {renderBulletList(
                    promotedOpportunitySignals.length > 0
                      ? promotedOpportunitySignals.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id)
                      : activeOpportunityList.map((entry: any) => typeof entry === 'string' ? entry : entry.opportunity),
                    'No promoted opportunity signals yet.',
                  )}
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Promoted timing and procurement</div>
                  {renderBulletList(
                    promotedTimingAndProcurement.length > 0
                      ? promotedTimingAndProcurement.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id)
                      : [
                          roadmap?.phase_1_engagement?.timeline && `Engagement: ${roadmap.phase_1_engagement.timeline}`,
                          roadmap?.phase_2_pilot?.timeline && `Pilot: ${roadmap.phase_2_pilot.timeline}`,
                          roadmap?.phase_3_partnership?.timeline && `Partnership: ${roadmap.phase_3_partnership.timeline}`,
                        ].filter(Boolean),
                    'No promoted timing or procurement markers yet.',
                  )}
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">Recommended next step</div>
                  <p className="mt-1 text-sm text-amber-700">
                    {valueOrFallback(timingAnalysis?.next_best_action || timingAnalysis?.summary, 'No procurement next step promoted yet.')}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Procurement questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderQuestionCards(procurementQuestions, 'No procurement or ecosystem questions are available yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decision-owners-pois" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Decision Owners / POIs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="text-sm font-semibold text-indigo-900">Promoted decision owner</div>
                  <p className="mt-1 text-sm text-indigo-700">
                    {valueOrFallback(connectionsSummary?.decision_owner || discoverySummary?.graphiti_sales_brief?.buyer_name || discoverySummary?.graphiti_sales_brief?.buyer_title, 'No decision owner promoted yet.')}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">Buyer brief</div>
                  <p className="mt-1 text-sm text-sky-700">
                    {valueOrFallback(connectionsSummary?.summary || discoverySummary?.graphiti_sales_brief?.outreach_target || strategic.recommended_approach, 'No buyer brief available yet.')}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">Recommended Yellow Panther owner</div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {valueOrFallback(connectionsSummary?.recommended_owner || discoverySummary?.graphiti_sales_brief?.best_path_owner, 'No Yellow Panther owner promoted yet.')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Promoted decision owners</div>
                  {renderBulletList(
                    promotedDecisionOwners.length > 0
                      ? promotedDecisionOwners.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id)
                      : [discoverySummary?.graphiti_sales_brief?.buyer_name, discoverySummary?.graphiti_sales_brief?.buyer_title].filter(Boolean),
                    'No promoted decision owners yet.',
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-600" />
                  Decision owner questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderQuestionCards(decisionOwnerQuestions, 'No decision owner or POI questions are available yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evidence-sources" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-emerald-600" />
                  Evidence / Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">Promoted evidence coverage</div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {promotedEvidenceCount > 0
                      ? `${promotedEvidenceCount} promoted evidence item${promotedEvidenceCount === 1 ? '' : 's'} available.`
                      : 'No promoted evidence coverage yet.'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Source state</div>
                  <p className="mt-1 text-sm text-slate-700">
                    {valueOrFallback(metadata.source_state || metadata.data_sources?.[0], 'Source state not available')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Question-first answers</div>
                  <p className="mt-1 text-sm text-slate-700">
                    {questionFirst?.questions_answered
                      ? `${questionFirst.questions_answered} question-first answers are available for inspection.`
                      : 'No question-first answer count is available yet.'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-orange-600" />
                  Evidence questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderQuestionCards(evidenceQuestions, 'No evidence or source questions are available yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default FinalRalphClubDossier
