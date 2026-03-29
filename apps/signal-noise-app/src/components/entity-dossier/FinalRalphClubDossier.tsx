"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Building,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Layers3,
  Network,
  Target,
  Users,
  Zap,
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'
import { buildHumanContextDossier } from "@/lib/human-context-dossier"
import { applyLiveTabStatus } from "@/lib/dossier-live-tab-status"
import { buildDossierTabs } from '@/lib/dossier-tabs'
import EntityQuestionPackRail from './EntityQuestionPackRail'
import DossierPhaseRail from '../discovery/DossierPhaseRail'
import type { EntityGraphEpisode } from "@/lib/entity-graph-timeline"
import type { EntityQuestionPack } from "@/lib/entity-question-pack"

interface FinalRalphClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier: any
  questionPack?: EntityQuestionPack | null
  graphEpisodes?: EntityGraphEpisode[] | null
}

function valueOrFallback(value: any, fallback: string) {
  const formatted = formatValue(value)
  return formatted || fallback
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

export function FinalRalphClubDossier({ entity, onEmailEntity, dossier, questionPack = null, graphEpisodes = [] }: FinalRalphClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const props = entity.properties
  const priority = getEntityPriority(entity)
  const humanContext = useMemo(() => buildHumanContextDossier(dossier, entity), [dossier, entity])
  const tabs = useMemo(
    () => buildDossierTabs(dossier, humanContext, { entityType: valueOrFallback(props.type, 'Club') }),
    [dossier, humanContext, props.type],
  )
  const questionPackWriteback = questionPack?.service_context?.writeback || null
  const featuredQuestions = questionPack?.questions?.slice(0, 3) || []
  const liveTabEvents = useMemo(
    () =>
      questionPack || graphEpisodes.length > 0
        ? [
            {
              type: 'graph_update',
              timestamp: graphEpisodes[0]?.created_at || new Date().toISOString(),
              data: {
                phaseIndex: questionPackWriteback?.persisted ? 5 : graphEpisodes.length > 0 ? 3 : 1,
                sectionStatuses: {
                  questions: questionPack ? 'filled' : 'missing',
                  overview: humanContext.sections.overview.status,
                  'commercial-digital-context': humanContext.sections.commercial_digital_context.status,
                  'temporal-relational-context':
                    graphEpisodes.length > 0 ? 'partial' : humanContext.sections.temporal_relational_context.status,
                  procurement: humanContext.sections.opportunity_narrative.status,
                  'digital-transformation': humanContext.sections.commercial_digital_context.status,
                  'strategic-analysis': humanContext.sections.opportunity_narrative.status,
                  opportunities: humanContext.sections.opportunity_narrative.status,
                  leadership: humanContext.sections.leadership_decision_shape.status,
                  connections: humanContext.sections.relationship_access.status,
                  'implementation-roadmap': dossier?.implementation_roadmap ? 'partial' : 'missing',
                  contact: humanContext.sections.relationship_access.status,
                  outreach: humanContext.sections.recommended_approach.status,
                  system: questionPackWriteback?.persisted ? 'filled' : 'partial',
                },
              },
            },
          ]
        : [],
    [graphEpisodes, humanContext, dossier, questionPack, questionPackWriteback],
  )
  const tabsWithStatus = useMemo(() => applyLiveTabStatus(tabs, liveTabEvents), [tabs, liveTabEvents])

  const coreInfo = dossier?.core_info || {}
  const digital = dossier?.digital_transformation || {}
  const strategic = dossier?.strategic_analysis || {}
  const roadmap = dossier?.implementation_roadmap || {}
  const linkedin = dossier?.linkedin_connection_analysis || {}
  const metadata = dossier?.metadata || {}
  const opportunities = strategic?.opportunity_scoring || {}
  const leadershipRecommendation = linkedin?.recommendations || {}

  const activeOpportunityList = Array.isArray(opportunities?.immediate_launch) ? opportunities.immediate_launch : []
  const mediumOpportunityList = Array.isArray(opportunities?.medium_term_partnerships) ? opportunities.medium_term_partnerships : []
  const longOpportunityList = Array.isArray(opportunities?.long_term_initiatives) ? opportunities.long_term_initiatives : []

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
        <CardContent className="grid gap-4 md:grid-cols-3">
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
            <div className="text-sm font-medium text-amber-700">Question pack</div>
            <div className="mt-1 text-lg font-semibold text-amber-950">
              {questionPack?.question_count || 0} questions
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200 bg-emerald-50/70 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-2xl text-emerald-950">
                <Layers3 className="h-5 w-5 text-emerald-600" />
                Active question queue
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7 text-emerald-800">
                This is the working queue for the persisted dossier. It should be the first thing you scan before drilling into tabs.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-emerald-900">
                {questionPack?.question_count || 0} questions
              </Badge>
              <Badge className="border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-emerald-900">
                {questionPackWriteback?.persisted ? 'Persisted writeback' : 'Pending writeback'}
              </Badge>
              <Badge className="border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-emerald-900">
                {questionPack?.entity_type || valueOrFallback(props.type, 'Club')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {featuredQuestions.map((question: any) => (
              <div key={question.question_id} className="min-h-[164px] rounded-3xl border border-emerald-200 bg-white/85 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-semibold leading-6 text-emerald-950">{question.question}</div>
                  <Badge variant="outline" className="border-emerald-300 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
                    {question.positioning_strategy.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-emerald-800">{question.accept_criteria}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {question.yp_service_fit.slice(0, 2).map((service: string) => (
                    <Badge key={`${question.question_id}-${service}`} variant="secondary" className="px-2.5 py-1 text-[11px]">
                      {service.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {questionPackWriteback?.artifact_path && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-100/60 p-4 text-sm text-emerald-950">
              <span className="font-semibold">Persisted artifact:</span> {String(questionPackWriteback.artifact_path)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <DossierPhaseRail
          entityName={valueOrFallback(props.name, 'Club')}
          dossier={dossier}
          nextAction={humanContext.sections.recommended_approach.content.next_best_action}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
          {tabsWithStatus.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex min-w-[180px] flex-1 items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <span>{tab.label}</span>
              {tab.status && (
                <Badge variant="outline" className="ml-auto border-slate-300 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {tab.status}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <EntityQuestionPackRail
            entityName={valueOrFallback(coreInfo.name, props.name || 'Club')}
            entityType={valueOrFallback(props.type, 'Club')}
            questionPack={questionPack}
          />
        </TabsContent>

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
                    {valueOrFallback(opportunities?.immediate_launch?.[0]?.opportunity, 'Opportunity not yet identified')}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">Recommended Approach</div>
                  <p className="mt-1 text-sm text-sky-700">{valueOrFallback(strategic.recommended_approach, 'Begin with evidence gathering and a scoped pilot')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="commercial-digital-context" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Commercial / Digital Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">Digital maturity summary</div>
                  <p className="mt-1 text-sm text-sky-700">{valueOrFallback(humanContext.sections.commercial_digital_context.content.digital_maturity_summary, 'Not yet established')}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">Commercial motion</div>
                  <p className="mt-1 text-sm text-emerald-700">{valueOrFallback(humanContext.sections.commercial_digital_context.content.commercial_motion, 'Not yet established')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Fan / Data Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(humanContext.sections.commercial_digital_context.content.fan_or_data_signals, 'No fan/data signals yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="temporal-relational-context" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  Timeline Anchors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(humanContext.sections.temporal_relational_context.content.timeline_anchors, 'No timeline anchors yet.')}
              </CardContent>
            </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5 text-indigo-600" />
                      Timeline episodes
                    </CardTitle>
                  </CardHeader>
              <CardContent className="space-y-3">
                {graphEpisodes.length > 0 ? (
                  <div className="space-y-3">
                    {graphEpisodes.slice(0, 6).map((episode) => (
                      <div key={episode.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{episode.summary}</div>
                          <Badge variant="outline">{episode.category}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {episode.created_at ? new Date(episode.created_at).toLocaleString() : 'Unknown date'}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                          {episode.source_url ? (
                            <a href={episode.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open source
                            </a>
                          ) : (
                            <span>Source unavailable</span>
                          )}
                          {episode.source_domain && <span>• {episode.source_domain}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No graph episodes available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="procurement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Procurement and Activation
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Buy signals</div>
                {renderBulletList([
                  ...(Array.isArray(roadmap?.phase_1_engagement?.objectives) ? roadmap.phase_1_engagement.objectives : []),
                  ...(Array.isArray(roadmap?.phase_2_pilot?.objectives) ? roadmap.phase_2_pilot.objectives : []),
                ], 'No procurement milestones recorded yet.')}
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Decision windows</div>
                {renderBulletList([
                  roadmap?.phase_1_engagement?.timeline && `Engagement: ${roadmap.phase_1_engagement.timeline}`,
                  roadmap?.phase_2_pilot?.timeline && `Pilot: ${roadmap.phase_2_pilot.timeline}`,
                  roadmap?.phase_3_partnership?.timeline && `Partnership: ${roadmap.phase_3_partnership.timeline}`,
                ].filter(Boolean), 'No timeline evidence yet.')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="digital-transformation" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Digital Posture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Digital maturity</span>
                    <span>{valueOrFallback(digital.digital_maturity, 'n/a')}/100</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(Number(digital.digital_maturity || 0), 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Transformation score</span>
                    <span>{valueOrFallback(digital.transformation_score, 'n/a')}/100</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(Number(digital.transformation_score || 0), 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-500">Current partner</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {valueOrFallback(digital.current_tech_partners?.[0], 'Not identified')}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  Strategic opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(digital.strategic_opportunities, 'No strategic opportunities yet.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategic-analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Strategic Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="text-sm font-semibold text-purple-900">Assessment</div>
                  <p className="mt-1 text-sm text-purple-700">{valueOrFallback(strategic.overall_assessment, 'No assessment yet')}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-900">Recommended approach</div>
                  <p className="mt-1 text-sm text-blue-700">{valueOrFallback(strategic.recommended_approach, 'No approach yet')}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Opportunity scoring</div>
                {renderBulletList(
                  [...activeOpportunityList, ...mediumOpportunityList, ...longOpportunityList].map((entry: any) => {
                    if (typeof entry === 'string') return entry
                    return `${entry.opportunity} (${entry.score}/100)`
                  }),
                  'No opportunity scores yet.',
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  Immediate launch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(activeOpportunityList.map((entry: any) => typeof entry === 'string' ? entry : entry.opportunity), 'No immediate launch items.')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Medium term
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(mediumOpportunityList.map((entry: any) => typeof entry === 'string' ? entry : entry.opportunity), 'No medium-term items.')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-violet-600" />
                  Long term
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderBulletList(longOpportunityList.map((entry: any) => typeof entry === 'string' ? entry : entry.opportunity), 'No long-term items.')}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leadership" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Leadership Anchors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <div className="text-sm font-semibold text-indigo-900">Recommended contact</div>
                <p className="mt-1 text-sm text-indigo-700">
                  {valueOrFallback(leadershipRecommendation.optimal_team_member, 'No leadership recommendation yet')}
                </p>
              </div>
              {renderBulletList(
                [
                  leadershipRecommendation.success_probability && `Success probability: ${leadershipRecommendation.success_probability}`,
                  leadershipRecommendation.recommended_approach && `Approach: ${leadershipRecommendation.recommended_approach}`,
                  leadershipRecommendation.confidence_level && `Confidence: ${leadershipRecommendation.confidence_level}`,
                ].filter(Boolean),
                'No leadership guidance yet.',
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-600" />
                Connection Graph
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderBulletList(
                [
                  linkedin?.yellow_panther_uk_team?.total_connections_found != null &&
                    `Team connections found: ${linkedin.yellow_panther_uk_team.total_connections_found}`,
                  linkedin?.tier_1_analysis?.introduction_paths?.length != null &&
                    `Tier 1 paths: ${linkedin.tier_1_analysis.introduction_paths.length}`,
                  linkedin?.tier_2_analysis?.tier_2_introduction_paths?.length != null &&
                    `Tier 2 paths: ${linkedin.tier_2_analysis.tier_2_introduction_paths.length}`,
                ].filter(Boolean),
                'No connection graph loaded yet.',
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation-roadmap" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-emerald-600" />
                Implementation Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(roadmap || {}).length > 0 ? (
                Object.entries(roadmap).map(([phaseKey, phaseValue]) => (
                  <div key={phaseKey} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">{phaseKey.replace(/_/g, ' ')}</div>
                      {typeof phaseValue === 'object' && phaseValue && 'timeline' in phaseValue && (
                        <Badge variant="outline">{String((phaseValue as any).timeline)}</Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {Array.isArray((phaseValue as any)?.objectives)
                        ? renderBulletList((phaseValue as any).objectives, 'No objectives recorded.')
                        : <p>No objectives recorded.</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No roadmap data available yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-slate-600" />
                System Writeback
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-500">Question pack</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {questionPack?.question_count ?? 0} questions
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-500">Writeback</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {questionPackWriteback?.persisted ? 'Persisted' : 'Pending'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-500">Artifact path</div>
                <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                  {String(questionPackWriteback?.artifact_path || 'Unknown')}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-500">Website</div>
                  <a className="text-blue-600 hover:underline" href={valueOrFallback(coreInfo.website, '#')} target="_blank" rel="noreferrer">
                    {valueOrFallback(coreInfo.website, 'No website available')}
                  </a>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">HQ</div>
                  <div className="text-sm text-slate-800">{valueOrFallback(coreInfo.hq, 'Unknown')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Stadium</div>
                  <div className="text-sm text-slate-800">{valueOrFallback(coreInfo.stadium, 'Unknown')}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-slate-600" />
                  Dossier Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>Generated: {valueOrFallback(metadata.generated_date, 'Unknown')}</div>
                <div>Schema version: {valueOrFallback(metadata.schema_version, 'Unknown')}</div>
                <div>Data sources: {Array.isArray(metadata.data_sources) ? metadata.data_sources.join(', ') : 'Unknown'}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="outreach" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-600" />
                Outreach Direction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="text-sm font-semibold text-orange-900">Recommended approach</div>
                <p className="mt-1 text-sm text-orange-700">{valueOrFallback(strategic.recommended_approach, 'Start with evidence gathering, confirm stakeholders, and scope a small pilot.')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Use the dossier sections above to choose the next question in the Ralph loop. The current dossier is already persisted, so outreach should follow the strongest validated section.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default FinalRalphClubDossier
