"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Mail, Trophy } from "lucide-react"

import { Entity, formatValue } from './types'

interface LeagueDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier?: any
}

export function LeagueDossier({ entity, onEmailEntity, dossier }: LeagueDossierProps) {
  const props = entity.properties
  const dossierMetadata = dossier?.metadata || dossier || {}
  const browserDossierUrl = dossierMetadata.browser_dossier_url || dossierMetadata.page_url || ''
  const sourceUrl = dossierMetadata.source_url || ''
  const signalState = dossierMetadata.signal_state || 'monitor_no_opportunity'
  const opportunityScore = dossierMetadata.opportunity_score
  const rfpConfidence = dossierMetadata.rfp_confidence
  const discoverySummary = dossier?.question_first?.discovery_summary || dossier?.discovery_summary || {}
  const opportunitySignals = Array.isArray(discoverySummary?.opportunity_signals) ? discoverySummary.opportunity_signals : []
  const decisionOwners = Array.isArray(discoverySummary?.decision_owners) ? discoverySummary.decision_owners : []
  const timingAndProcurement = Array.isArray(discoverySummary?.timing_procurement_markers)
    ? discoverySummary.timing_procurement_markers
    : Array.isArray(discoverySummary?.timing_and_procurement)
      ? discoverySummary.timing_and_procurement
      : Array.isArray(discoverySummary?.timing_markers)
        ? discoverySummary.timing_markers
        : []
  const supportingEvidenceCount = Number(discoverySummary?.supporting_evidence_count || 0)
  const hasPromotedEvidence = opportunitySignals.length > 0 || decisionOwners.length > 0 || timingAndProcurement.length > 0 || supportingEvidenceCount > 0
  
  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'L'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-orange-600" />
                  {props.name || 'League Entity'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Governing Body</span>
                  <span>{props.sport || 'Multi-sport'}</span>
                  <span>{props.region || 'International'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 font-medium">
                LEAGUE
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>League Intelligence Dossier</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPromotedEvidence ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">
                <FileText className="h-4 w-4" />
                Promoted league discovery synthesis
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Opportunity signals</div>
                  <div className="mt-2 text-2xl font-semibold">{opportunitySignals.length}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {opportunitySignals[0]?.answer || 'No promoted opportunity signals yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decision owners</div>
                  <div className="mt-2 text-2xl font-semibold">{decisionOwners.length}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {decisionOwners[0]?.answer || 'No promoted decision-owner evidence yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Timing and procurement</div>
                  <div className="mt-2 text-2xl font-semibold">{timingAndProcurement.length}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {timingAndProcurement[0]?.answer || 'No promoted timing or procurement markers yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Supporting evidence</div>
                  <div className="mt-2 text-2xl font-semibold">{supportingEvidenceCount}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {dossier?.question_first?.dossier_promotions?.[0]?.evidence_url || 'No promoted evidence URLs yet.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Awaiting promoted dossier evidence</h4>
                <p className="text-muted-foreground">
                  No persisted discovery synthesis is available for this league yet. Use enrichment or the pipeline to populate opportunity signals, decision owners, and timing/procurement markers before treating this as an active dossier.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <h4 className="font-semibold mb-2">League Overview</h4>
                  <p className="text-muted-foreground">
                    {formatValue(props.description) || 'League information and governance structure.'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Member Clubs</h4>
                  <p className="text-muted-foreground">
                    {formatValue(props.memberCount) || 'Multiple member organizations'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Commercial Strategy</h4>
                  <p className="text-muted-foreground">
                    {formatValue(props.commercialStrategy) || 'Media rights and commercial partnerships.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {dossier && (
        <Card>
          <CardHeader>
            <CardTitle>Dossier References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {browserDossierUrl && (
                <div>
                  <h4 className="font-semibold mb-1">Dossier Page</h4>
                  <a href={browserDossierUrl} className="text-blue-600 hover:underline break-all" target="_blank" rel="noreferrer">
                    {browserDossierUrl}
                  </a>
                </div>
              )}
              {sourceUrl && (
                <div>
                  <h4 className="font-semibold mb-1">Source URL</h4>
                  <a href={sourceUrl} className="text-blue-600 hover:underline break-all" target="_blank" rel="noreferrer">
                    {sourceUrl}
                  </a>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Signal State: {signalState}</Badge>
              {typeof opportunityScore === 'number' && <Badge variant="outline">Opportunity: {opportunityScore}/100</Badge>}
              {typeof rfpConfidence === 'number' && <Badge variant="outline">RFP Confidence: {Math.round(rfpConfidence * 100)}%</Badge>}
            </div>
            {dossierMetadata.decision_summary && (
              <p className="text-sm text-muted-foreground">{dossierMetadata.decision_summary}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
