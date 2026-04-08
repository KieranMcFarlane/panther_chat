"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Entity } from "./types"

interface QuestionFirstEntityDossierProps {
  entity: Entity
  dossier: any
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function collectEvidence(dossier: any) {
  const evidenceItems = Array.isArray(dossier?.question_first?.evidence_items) ? dossier.question_first.evidence_items : []
  const promotedItems = Array.isArray(dossier?.question_first?.dossier_promotions) ? dossier.question_first.dossier_promotions : []
  return [...promotedItems, ...evidenceItems]
}

function collectPOIs(dossier: any) {
  const summaryOwners = Array.isArray(dossier?.question_first?.discovery_summary?.decision_owners)
    ? dossier.question_first.discovery_summary.decision_owners
    : []
  const poiNodes = Array.isArray(dossier?.poi_graph?.nodes) ? dossier.poi_graph.nodes : []
  return [...summaryOwners, ...poiNodes]
}

function collectProcurementSignals(dossier: any) {
  const timingMarkers = Array.isArray(dossier?.question_first?.discovery_summary?.timing_procurement_markers)
    ? dossier.question_first.discovery_summary.timing_procurement_markers
    : []
  const opportunitySignals = Array.isArray(dossier?.question_first?.discovery_summary?.opportunity_signals)
    ? dossier.question_first.discovery_summary.opportunity_signals
    : []
  return [...timingMarkers, ...opportunitySignals]
}

function collectDigitalSignals(dossier: any) {
  const digitalStack = Array.isArray(dossier?.question_first?.discovery_summary?.digital_stack)
    ? dossier.question_first.discovery_summary.digital_stack
    : []
  const answers = Array.isArray(dossier?.answers) ? dossier.answers : []
  return digitalStack.length > 0 ? digitalStack : answers.filter((answer: any) => /digital|stack|platform|app|crm|ticket/i.test(String(answer?.question || "")))
}

function renderItems(items: any[], emptyLabel: string, getTitle: (item: any, index: number) => string, getBody?: (item: any) => string) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={`${getTitle(item, index)}-${index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-sm font-semibold text-foreground">{getTitle(item, index)}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {getBody ? getBody(item) : toText(item?.answer || item?.summary || item?.description || item)}
          </p>
        </div>
      ))}
    </div>
  )
}

export function QuestionFirstEntityDossier({ entity, dossier }: QuestionFirstEntityDossierProps) {
  const tabs = useMemo(() => (Array.isArray(dossier?.tabs) ? dossier.tabs : []), [dossier])
  const [activeTab, setActiveTab] = useState(tabs[0]?.value || "overview")
  const answers = Array.isArray(dossier?.answers) ? dossier.answers : []
  const evidence = collectEvidence(dossier)
  const pois = collectPOIs(dossier)
  const procurementSignals = collectProcurementSignals(dossier)
  const digitalSignals = collectDigitalSignals(dossier)
  const salesBrief = dossier?.question_first?.discovery_summary?.graphiti_sales_brief

  return (
    <Card className="border-border/70 bg-card/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{dossier?.entity_name || entity.properties?.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Canonical question-first dossier rendered from the normalized API payload.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{dossier?.entity_type || entity.properties?.type || "Entity"}</Badge>
            <Badge variant="outline">
              {Number(dossier?.run_rollup?.questions_answered || answers.length)} answers
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-5">
            {tabs.map((tab: any) => (
              <TabsTrigger key={tab.value} value={tab.value} className="border border-border/70 bg-background/70 px-3 py-2 text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Entity</p>
                <p className="mt-2 text-base font-semibold text-foreground">{dossier?.entity_name || entity.properties?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{dossier?.entity_type || entity.properties?.type || "Entity"}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Run rollup</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {Number(dossier?.run_rollup?.questions_answered || answers.length)} answered
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {toText(dossier?.run_rollup?.summary || dossier?.metadata?.question_first?.summary || "Question-first synthesis ready")}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Generated</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {toText(dossier?.question_first?.generated_at || dossier?.metadata?.question_first?.generated_at || "Not available")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {toText(dossier?.metadata?.question_first?.artifact_source || dossier?.metadata?.question_first?.source || "question_first_dossier")}
                </p>
              </div>
            </div>
            {salesBrief?.status === "available" ? (
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sales brief</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{toText(salesBrief?.buyer_name || "Buyer hypothesis")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toText(salesBrief?.buyer_title || salesBrief?.outreach_angle || "Commercial decision owner")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{toText(salesBrief?.best_path_owner || "Path not ranked")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toText(salesBrief?.path_type ? `Route: ${salesBrief.path_type}` : "No connection route materialized")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Capability gap</p>
                    <p className="mt-1 text-sm text-muted-foreground">{toText(salesBrief?.capability_gap || "Not available")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Outreach strategy</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toText(salesBrief?.outreach_target || "No target")}
                      {salesBrief?.outreach_route ? ` via ${salesBrief.outreach_route}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {renderItems(
              answers.slice(0, 3),
              "No question-first answers are available yet.",
              (item, index) => item?.question || `Answer ${index + 1}`,
              (item) => item?.answer || item?.summary || "",
            )}
          </TabsContent>

          <TabsContent value="digital-stack" className="space-y-4">
            {renderItems(
              digitalSignals,
              "No digital stack signals are available yet.",
              (item, index) => item?.signal || item?.question || `Digital signal ${index + 1}`,
            )}
          </TabsContent>

          <TabsContent value="procurement-ecosystem" className="space-y-4">
            {renderItems(
              procurementSignals,
              "No procurement or ecosystem signals are available yet.",
              (item, index) => item?.signal || item?.question || `Procurement signal ${index + 1}`,
            )}
          </TabsContent>

          <TabsContent value="decision-owners-pois" className="space-y-4">
            {renderItems(
              pois,
              "No decision owners or POIs are available yet.",
              (item, index) => item?.name || item?.title || item?.question || `POI ${index + 1}`,
            )}
          </TabsContent>

          <TabsContent value="evidence-sources" className="space-y-4">
            {renderItems(
              evidence,
              "No promoted evidence is available yet.",
              (item, index) => item?.title || item?.url || `Evidence ${index + 1}`,
              (item) => item?.summary || item?.answer || item?.url || "",
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default QuestionFirstEntityDossier
