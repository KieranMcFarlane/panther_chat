"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Network,
  Target,
  Users,
  Zap,
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'
import { buildDossierTabs } from '@/lib/dossier-tabs'

interface FinalRalphClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier: any
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

export function FinalRalphClubDossier({ entity, onEmailEntity, dossier }: FinalRalphClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const props = entity.properties
  const priority = getEntityPriority(entity)
  const tabs = useMemo(() => buildDossierTabs(dossier, { entityType: valueOrFallback(props.type, 'Club') }), [dossier, props.type])

  const coreInfo = dossier?.core_info || {}
  const digital = dossier?.digital_transformation || {}
  const strategic = dossier?.strategic_analysis || {}
  const roadmap = dossier?.implementation_roadmap || {}
  const linkedin = dossier?.linkedin_connection_analysis || {}
  const questionFirst = dossier?.question_first || {}
  const discoverySummary = dossier?.question_first?.discovery_summary || {}
  const dossierPromotions = Array.isArray(dossier?.question_first?.dossier_promotions) ? dossier.question_first.dossier_promotions : []
  const metadata = dossier?.metadata || {}
  const opportunities = strategic?.opportunity_scoring || {}
  const leadershipRecommendation = linkedin?.recommendations || {}

  const activeOpportunityList = Array.isArray(opportunities?.immediate_launch) ? opportunities.immediate_launch : []
  const mediumOpportunityList = Array.isArray(opportunities?.medium_term_partnerships) ? opportunities.medium_term_partnerships : []
  const longOpportunityList = Array.isArray(opportunities?.long_term_initiatives) ? opportunities.long_term_initiatives : []
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
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-lg bg-gray-100 p-1 md:grid-cols-10">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <span>{tab.label}</span>
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
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Evidence-backed opportunity signals</div>
                {renderBulletList(
                  promotedOpportunitySignals.length > 0
                    ? promotedOpportunitySignals.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id)
                    : [
                        ...(Array.isArray(roadmap?.phase_1_engagement?.objectives) ? roadmap.phase_1_engagement.objectives : []),
                        ...(Array.isArray(roadmap?.phase_2_pilot?.objectives) ? roadmap.phase_2_pilot.objectives : []),
                      ],
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
                  promotedOpportunitySignals.length > 0
                    ? promotedOpportunitySignals.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id)
                    : [...activeOpportunityList, ...mediumOpportunityList, ...longOpportunityList].map((entry: any) => {
                        if (typeof entry === 'string') return entry
                        return `${entry.opportunity} (${entry.score}/100)`
                      }),
                  'No promoted opportunity scores yet.',
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Promoted decision owners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderBulletList(
                  promotedDecisionOwners.map((entry: any) => entry?.answer || entry?.question_text || entry?.candidate_id),
                  'No promoted decision owners yet.',
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-600" />
                  Promoted evidence coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-semibold text-slate-900">{promotedEvidenceCount}</div>
                <div className="text-sm text-slate-600">
                  {questionFirst?.questions_answered
                    ? `${questionFirst.questions_answered} question-first answers available for promotion.`
                    : 'No promoted evidence coverage yet.'}
                </div>
              </CardContent>
            </Card>
          </div>
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
