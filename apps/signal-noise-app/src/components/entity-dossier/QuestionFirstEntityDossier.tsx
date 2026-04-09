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

type QuestionRecord = {
  question_id?: string
  question_text?: string
  question?: string
  signal_type?: string
  answer?: Record<string, any> | null
  terminal_state?: "answered" | "no_signal" | "blocked" | string
  terminal_summary?: string
  blocked_by?: string[]
  [key: string]: any
}

type EvidenceSource = {
  label: string
  url: string | null
}

type EvidenceGroup = {
  title: string
  summary: string
  sources: EvidenceSource[]
}

type PoiCandidate = {
  name: string
  title?: string
  organization?: string
  linkedin_url?: string
  email?: string
  bio?: string
  recent_post_summary?: string
  recent_post_urls?: string[]
  relevance?: string
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

function ensureObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {}
}

function collectPOIs(dossier: any) {
  const summaryOwners = Array.isArray(dossier?.question_first?.discovery_summary?.decision_owners)
    ? dossier.question_first.discovery_summary.decision_owners
    : []
  const poiNodes = Array.isArray(dossier?.poi_graph?.nodes) ? dossier.poi_graph.nodes : []
  return [...summaryOwners, ...poiNodes]
}

function collectQuestionRecords(dossier: any): QuestionRecord[] {
  if (Array.isArray(dossier?.questions) && dossier.questions.length > 0) {
    return dossier.questions
  }

  if (Array.isArray(dossier?.answers)) {
    return dossier.answers
  }

  return []
}

function titleCaseSignal(signalType: string) {
  return signalType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getQuestionTitle(item: QuestionRecord, index: number) {
  return (
    toText(item?.question_text) ||
    toText(item?.question) ||
    toText(item?.question_id) ||
    (toText(item?.signal_type) ? titleCaseSignal(toText(item.signal_type)) : "") ||
    `Answer ${index + 1}`
  )
}

function formatStructuredFact(answer: Record<string, any>) {
  const rawAnswer = answer?.raw_structured_output?.answer
  if (rawAnswer && typeof rawAnswer === "object" && !Array.isArray(rawAnswer)) {
    return Object.entries(rawAnswer)
      .slice(0, 12)
      .map(([key, value]) => `${key.replace(/_/g, " ")}: ${toText(value)}`)
      .join("\n")
  }

  return toText(answer?.summary || answer?.value || rawAnswer)
}

function formatStructuredList(answer: Record<string, any>) {
  const candidates = Array.isArray(answer?.raw_structured_output?.candidates)
    ? answer.raw_structured_output.candidates
    : []

  if (candidates.length > 0) {
    return candidates
      .slice(0, 8)
      .map((candidate: any) => {
        const name = toText(candidate?.name || candidate?.title || candidate)
        const role = toText(candidate?.title || candidate?.role)
        return role ? `${name} - ${role}` : name
      })
      .filter(Boolean)
      .join("\n")
  }

  return toText(answer?.summary || answer?.raw_structured_output?.answer || answer?.value)
}

function formatQuestionAnswer(item: QuestionRecord) {
  const answer = item?.answer && typeof item.answer === "object" ? item.answer : null
  if (!answer) {
    return ""
  }

  if (answer.kind === "fact") {
    return formatStructuredFact(answer)
  }

  if (answer.kind === "list") {
    return formatStructuredList(answer)
  }

  if (answer.kind === "signal_set") {
    const topSignals = Array.isArray(answer.top_signals) ? answer.top_signals : []
    if (topSignals.length > 0) {
      return topSignals
        .slice(0, 8)
        .map((signal: any) => {
          const name = toText(signal?.name || signal)
          const version = toText(signal?.version)
          return version ? `${name} (${version})` : name
        })
        .filter(Boolean)
        .join(", ")
    }
  }

  return toText(
    answer.summary ||
      answer.value ||
      answer.raw_structured_output?.answer ||
      answer.raw_structured_output?.context ||
      answer.raw_structured_output?.notes,
  )
}

function normalizePoiCandidate(value: unknown): PoiCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, any>
  const name = toText(record.name || record.full_name || record.person)
  if (!name) {
    return null
  }

  const recentPostUrls = Array.isArray(record.recent_post_urls)
    ? record.recent_post_urls.map((item) => toText(item)).filter(Boolean)
    : []

  const candidate: PoiCandidate = { name }
  const title = toText(record.title || record.role)
  const organization = toText(record.organization || record.company)
  const linkedinUrl = toText(record.linkedin_url || record.linkedin || record.profile_url)
  const email = toText(record.email)
  const bio = toText(record.bio || record.summary || record.description)
  const recentPostSummary = toText(record.recent_post_summary)
  const relevance = toText(record.relevance)

  if (title) candidate.title = title
  if (organization) candidate.organization = organization
  if (linkedinUrl) candidate.linkedin_url = linkedinUrl
  if (email) candidate.email = email
  if (bio) candidate.bio = bio
  if (recentPostSummary) candidate.recent_post_summary = recentPostSummary
  if (recentPostUrls.length > 0) candidate.recent_post_urls = recentPostUrls
  if (relevance) candidate.relevance = relevance
  return candidate
}

function extractPoiCandidates(item: QuestionRecord): PoiCandidate[] {
  const answer = item?.answer && typeof item.answer === "object" ? item.answer : null
  const rawStructuredOutput = answer?.raw_structured_output && typeof answer.raw_structured_output === "object"
    ? answer.raw_structured_output
    : null

  const candidates = Array.isArray(rawStructuredOutput?.candidates)
    ? rawStructuredOutput.candidates
    : []

  return candidates.map((candidate) => normalizePoiCandidate(candidate)).filter(Boolean) as PoiCandidate[]
}

function normalizeSourceRecord(value: unknown): EvidenceSource | null {
  if (typeof value === "string") {
    const text = toText(value)
    if (!text || text.startsWith("ev:")) {
      return null
    }
    return {
      label: text,
      url: /^https?:\/\//i.test(text) ? text : null,
    }
  }

  const objectValue = ensureObject(value)
  const url = toText(objectValue.url || objectValue.href || objectValue.source_url)
  const label = toText(objectValue.label || objectValue.title || objectValue.summary || url)
  if (!label && !url) {
    return null
  }

  return {
    label: label || url,
    url: url || null,
  }
}

function buildEvidenceIndex(dossier: any) {
  const evidenceIndex = new Map<string, EvidenceSource>()
  const evidenceItems = Array.isArray(dossier?.question_first?.evidence_items) ? dossier.question_first.evidence_items : []
  const promotedItems = Array.isArray(dossier?.question_first?.dossier_promotions) ? dossier.question_first.dossier_promotions : []

  for (const item of [...promotedItems, ...evidenceItems]) {
    const record = ensureObject(item)
    const refId = toText(record.id || record.evidence_id || record.ref || record.trace_ref)
    const source = normalizeSourceRecord(record)
    if (refId && source) {
      evidenceIndex.set(refId, source)
    }

    const rawRefs = Array.isArray(record.evidence_refs) ? record.evidence_refs : []
    for (const rawRef of rawRefs) {
      const refKey = toText(rawRef)
      const refSource = source || normalizeSourceRecord(rawRef)
      if (refKey && refSource) {
        evidenceIndex.set(refKey, refSource)
      }
    }
  }

  return evidenceIndex
}

function extractQuestionSources(item: QuestionRecord, evidenceIndex: Map<string, EvidenceSource>) {
  const answer = item?.answer && typeof item.answer === "object" ? item.answer : null
  const rawStructuredOutput = answer?.raw_structured_output && typeof answer.raw_structured_output === "object"
    ? answer.raw_structured_output
    : null
  const questionFirstAnswer = item?.question_first_answer && typeof item.question_first_answer === "object"
    ? item.question_first_answer
    : null
  const directSources = [
    ...(Array.isArray(rawStructuredOutput?.sources) ? rawStructuredOutput.sources : []),
    ...(Array.isArray(questionFirstAnswer?.timeout_salvage?.candidate_evidence_urls) ? questionFirstAnswer.timeout_salvage.candidate_evidence_urls : []),
  ]
    .map((value) => normalizeSourceRecord(value))
    .filter(Boolean) as EvidenceSource[]
  const resolvedRefs = (Array.isArray(item?.evidence_refs) ? item.evidence_refs : [])
    .map((value) => evidenceIndex.get(toText(value)) || normalizeSourceRecord(value))
    .filter(Boolean) as EvidenceSource[]

  const deduped = new Map<string, EvidenceSource>()
  for (const source of [...directSources, ...resolvedRefs]) {
    const key = source.url || source.label
    if (key) {
      deduped.set(key, source)
    }
  }

  return Array.from(deduped.values())
}

function buildEvidenceGroups(questionRecords: QuestionRecord[], dossier: any): EvidenceGroup[] {
  const evidenceIndex = buildEvidenceIndex(dossier)
  return questionRecords
    .map((item, index) => ({
      title: getQuestionTitle(item, index),
      summary: getQuestionTerminalSummary(item),
      sources: extractQuestionSources(item, evidenceIndex),
    }))
    .filter((item) => item.sources.length > 0)
}

function getQuestionTerminalState(item: QuestionRecord) {
  return toText(item?.terminal_state || item?.question_first_answer?.terminal_state || item?.answer?.terminal_state || "no_signal") || "no_signal"
}

function getQuestionTerminalSummary(item: QuestionRecord) {
  return (
    toText(item?.terminal_summary) ||
    toText(item?.question_first_answer?.terminal_summary) ||
    toText(item?.answer?.summary) ||
    toText(item?.answer?.raw_structured_output?.context) ||
    toText(item?.answer?.raw_structured_output?.notes) ||
    toText(item?.question_first_answer?.notes)
  )
}

function getQuestionBody(item: QuestionRecord) {
  const formatted = formatQuestionAnswer(item)
  if (formatted) {
    return formatted
  }
  return getQuestionTerminalSummary(item)
}

function getQuestionStatusLabel(item: QuestionRecord) {
  const terminalState = getQuestionTerminalState(item)
  if (terminalState === "answered") return "Answered"
  if (terminalState === "blocked") return "Blocked"
  return "No signal"
}

function getQuestionStatusClasses(item: QuestionRecord) {
  const terminalState = getQuestionTerminalState(item)
  if (terminalState === "answered") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
  }
  if (terminalState === "blocked") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200"
  }
  return "border-white/10 bg-white/5 text-slate-200"
}

function getQuestionBucket(item: QuestionRecord) {
  const questionId = toText(item?.question_id)
  const signalType = toText(item?.signal_type)
  if (["q2_digital_stack", "q4_performance", "q5_league_context"].includes(questionId) || ["DIGITAL_STACK", "PERFORMANCE", "LEAGUE_CONTEXT"].includes(signalType)) {
    return "digital-stack"
  }
  if (["q7_procurement_signal", "q8_explicit_rfp", "q9_news_signal", "q10_hiring_signal"].includes(questionId) || ["PROCUREMENT_SIGNAL", "TENDER_DOCS", "NEWS_SIGNAL", "HIRING_SIGNAL", "LAUNCH_SIGNAL"].includes(signalType)) {
    return "procurement-ecosystem"
  }
  if (["q3_leadership", "q11_decision_owner", "q12_connections", "q14_yp_fit", "q15_outreach_strategy"].includes(questionId) || ["LEADERSHIP", "DECISION_OWNER", "POI", "YP_FIT", "OUTREACH_STRATEGY", "CONNECTIONS"].includes(signalType)) {
    return "decision-owners-pois"
  }
  return "overview"
}

function getDossierQualityLabel(dossier: any) {
  const qualityState = toText(dossier?.quality_state || dossier?.metadata?.question_first?.quality_state).toLowerCase()
  if (qualityState === "client_ready") return "Client-ready dossier"
  if (qualityState === "complete") return "Complete dossier"
  if (qualityState === "blocked") return "Blocked dossier"
  return "Partial dossier"
}

function getDossierQualityClasses(dossier: any) {
  const qualityState = toText(dossier?.quality_state || dossier?.metadata?.question_first?.quality_state).toLowerCase()
  if (qualityState === "client_ready") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
  if (qualityState === "complete") return "border-sky-400/30 bg-sky-500/10 text-sky-100"
  if (qualityState === "blocked") return "border-amber-400/30 bg-amber-500/10 text-amber-200"
  return "border-white/10 bg-white/5 text-slate-200"
}

function renderTabEmptyState(label: string) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-5">
      <p className="text-sm font-medium text-foreground">No applicable dossier content</p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function renderQuestionCards(items: QuestionRecord[], emptyLabel: string, evidenceIndex: Map<string, EvidenceSource>) {
  if (items.length === 0) {
    return renderTabEmptyState(emptyLabel)
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const questionSources = extractQuestionSources(item, evidenceIndex)
        const questionBody = getQuestionBody(item) || getQuestionTerminalSummary(item) || "No validated answer was produced for this question."
        return (
          <div key={`${getQuestionTitle(item, index)}-${index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{getQuestionTitle(item, index)}</p>
              <Badge className={getQuestionStatusClasses(item)} variant="outline">{getQuestionStatusLabel(item)}</Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{questionBody}</p>
            {getQuestionTerminalState(item) === "blocked" && Array.isArray(item?.blocked_by) && item.blocked_by.length > 0 ? (
              <p className="mt-3 text-xs text-amber-200">Blocked by: {item.blocked_by.join(", ")}</p>
            ) : null}
            {questionSources.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
                {questionSources.slice(0, 4).map((source) => (
                  source.url ? (
                    <a
                      key={`${source.label}-${source.url}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-sky-300 underline underline-offset-2"
                    >
                      {source.label}
                    </a>
                  ) : (
                    <p key={source.label} className="truncate text-xs text-muted-foreground">{source.label}</p>
                  )
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function renderEvidenceCards(items: EvidenceGroup[], emptyLabel: string) {
  if (items.length === 0) {
    return renderTabEmptyState(emptyLabel)
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {item.summary || "Evidence exists for this question, but no higher-confidence summary was promoted."}
          </p>
          <div className="mt-3 space-y-1">
            {item.sources.map((source) => (
              source.url ? (
                <a
                  key={`${source.label}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-sky-300 underline underline-offset-2"
                >
                  {source.label}
                </a>
              ) : (
                <p key={source.label} className="truncate text-xs text-muted-foreground">{source.label}</p>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderPoiQuestionCards(items: QuestionRecord[], emptyLabel: string, evidenceIndex: Map<string, EvidenceSource>) {
  if (items.length === 0) {
    return renderTabEmptyState(emptyLabel)
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const questionSources = extractQuestionSources(item, evidenceIndex)
        const candidates = extractPoiCandidates(item)
        const questionBody = getQuestionBody(item) || getQuestionTerminalSummary(item) || "No validated POI answer was produced for this question."

        return (
          <div key={`${getQuestionTitle(item, index)}-${index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{getQuestionTitle(item, index)}</p>
              <Badge className={getQuestionStatusClasses(item)} variant="outline">{getQuestionStatusLabel(item)}</Badge>
            </div>

            {candidates.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {candidates.slice(0, 6).map((candidate) => (
                  <div key={`${candidate.name}-${candidate.title || ""}`} className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[candidate.title, candidate.organization].filter(Boolean).join(" · ") || "Role not confirmed"}
                        </p>
                      </div>
                      {candidate.relevance ? (
                        <Badge variant="outline" className="text-[11px]">
                          {candidate.relevance}
                        </Badge>
                      ) : null}
                    </div>

                    {candidate.bio ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{candidate.bio}</p>
                    ) : null}

                    {candidate.recent_post_summary ? (
                      <div className="mt-3 rounded-md border border-sky-400/20 bg-sky-500/5 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">Post context</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{candidate.recent_post_summary}</p>
                      </div>
                    ) : null}

                    {(candidate.email || candidate.linkedin_url) ? (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        {candidate.email ? (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Verified email</span>: {candidate.email}
                          </p>
                        ) : null}
                        {candidate.linkedin_url ? (
                          <a
                            href={candidate.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-300 underline underline-offset-2"
                          >
                            LinkedIn
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {Array.isArray(candidate.recent_post_urls) && candidate.recent_post_urls.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recent posts</p>
                        {candidate.recent_post_urls.slice(0, 3).map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs text-sky-300 underline underline-offset-2"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{questionBody}</p>
            )}

            {getQuestionTerminalState(item) === "blocked" && Array.isArray(item?.blocked_by) && item.blocked_by.length > 0 ? (
              <p className="mt-3 text-xs text-amber-200">Blocked by: {item.blocked_by.join(", ")}</p>
            ) : null}

            {questionSources.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
                {questionSources.slice(0, 4).map((source) => (
                  source.url ? (
                    <a
                      key={`${source.label}-${source.url}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-sky-300 underline underline-offset-2"
                    >
                      {source.label}
                    </a>
                  ) : (
                    <p key={source.label} className="truncate text-xs text-muted-foreground">{source.label}</p>
                  )
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function QuestionFirstEntityDossier({ entity, dossier }: QuestionFirstEntityDossierProps) {
  const tabs = useMemo(() => (Array.isArray(dossier?.tabs) ? dossier.tabs : []), [dossier])
  const [activeTab, setActiveTab] = useState(tabs[0]?.value || "overview")
  const questionRecords = collectQuestionRecords(dossier)
  const evidenceIndex = useMemo(() => buildEvidenceIndex(dossier), [dossier])
  const overviewQuestions = questionRecords.filter((item) => getQuestionBucket(item) === "overview").slice(0, 5)
  const pois = (() => {
    const promoted = collectPOIs(dossier)
    return promoted.length > 0
      ? promoted
      : questionRecords.filter((item) => getQuestionBucket(item) === "decision-owners-pois")
  })()
  const procurementSignals = questionRecords.filter((item) => getQuestionBucket(item) === "procurement-ecosystem")
  const digitalSignals = questionRecords.filter((item) => getQuestionBucket(item) === "digital-stack")
  const evidenceGroups = useMemo(() => buildEvidenceGroups(questionRecords, dossier), [questionRecords, dossier])
  const salesBrief = dossier?.question_first?.discovery_summary?.graphiti_sales_brief
  const qualitySummary = toText(dossier?.quality_summary || dossier?.metadata?.question_first?.quality_summary)
  const qualityBlockers = Array.isArray(dossier?.quality_blockers || dossier?.metadata?.question_first?.quality_blockers)
    ? (dossier?.quality_blockers || dossier?.metadata?.question_first?.quality_blockers)
    : []

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
            <Badge className={getDossierQualityClasses(dossier)} variant="outline">{getDossierQualityLabel(dossier)}</Badge>
            <Badge variant="outline">
              {Number(dossier?.run_rollup?.questions_answered || questionRecords.length)} answers
            </Badge>
            {dossier?.validation_sample ? <Badge variant="outline">Validation sample</Badge> : null}
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
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Entity</p>
                <p className="mt-2 text-base font-semibold text-foreground">{dossier?.entity_name || entity.properties?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{dossier?.entity_type || entity.properties?.type || "Entity"}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Run rollup</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {Number(dossier?.run_rollup?.questions_answered || questionRecords.length)} answered
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
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quality state</p>
                <p className="mt-2 text-base font-semibold text-foreground">{getDossierQualityLabel(dossier)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{qualitySummary || "No dossier quality summary is available yet."}</p>
              </div>
            </div>

            {qualityBlockers.length > 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Quality blockers</p>
                <div className="mt-2 space-y-1">
                  {qualityBlockers.slice(0, 4).map((blocker: string) => (
                    <p key={blocker} className="text-sm text-amber-100">{toText(blocker)}</p>
                  ))}
                </div>
              </div>
            ) : null}

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

            {renderQuestionCards(overviewQuestions, "No question-first answers are available yet.", evidenceIndex)}
          </TabsContent>

          <TabsContent value="digital-stack" className="space-y-4">
            {renderQuestionCards(digitalSignals, "No digital stack signals are available yet.", evidenceIndex)}
          </TabsContent>

          <TabsContent value="procurement-ecosystem" className="space-y-4">
            {renderQuestionCards(procurementSignals, "No procurement or ecosystem signals are available yet.", evidenceIndex)}
          </TabsContent>

          <TabsContent value="decision-owners-pois" className="space-y-4">
            {Array.isArray(pois) && pois.length > 0 && !("question_id" in (pois[0] || {})) ? (
              <div className="grid gap-3">
                {pois.map((item: any, index: number) => (
                  <div key={`${item?.name || item?.title || index}`} className="rounded-xl border border-border/70 bg-card/60 p-4">
                    <p className="text-sm font-semibold text-foreground">{item?.name || item?.title || `POI ${index + 1}`}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {toText(item?.title || item?.summary || item?.description || "No descriptive summary is available.")}
                    </p>
                  </div>
                ))}
              </div>
            ) : renderPoiQuestionCards(pois as QuestionRecord[], "No decision owners or POIs are available yet.", evidenceIndex)}
          </TabsContent>

          <TabsContent value="evidence-sources" className="space-y-4">
            {renderEvidenceCards(evidenceGroups, "No promoted evidence is available yet.")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default QuestionFirstEntityDossier
