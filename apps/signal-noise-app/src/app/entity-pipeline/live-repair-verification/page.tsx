import Link from 'next/link'
import { CheckCircle2, ExternalLink, FileText, Gauge, Route, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getEntityPipelineRun } from '@/lib/entity-import-jobs'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import { requirePageSession } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const ENTITY_ID = 'fc-porto-2027'
const BATCH_ID = 'import_1775815384658'

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getQuestionState(question: Record<string, any> | undefined): string {
  return toText(
    question?.terminal_state
    || question?.question_first_answer?.terminal_state
    || question?.answer?.terminal_state
    || question?.validation_state
    || question?.question_first_answer?.validation_state,
  ) || 'unknown'
}

function getQuestionSummary(question: Record<string, any> | undefined): string {
  return toText(
    question?.terminal_summary
    || question?.question_first_answer?.terminal_summary
    || question?.answer?.summary,
  ) || 'No summary available.'
}

function formatRunType(publicationMode: string): string {
  return publicationMode.startsWith('repair') ? 'Repair run' : 'Full run'
}

function formatPublicationHealth(publicationStatus: string, reconcileRequired: boolean): string {
  if (publicationStatus === 'published_degraded') return 'Published degraded'
  if (publicationStatus === 'published') return 'Published healthy'
  return reconcileRequired ? 'Publish failed' : 'Publish failed'
}

export default async function LiveRepairVerificationPage() {
  await requirePageSession('/entity-pipeline/live-repair-verification')

  const canonical = await resolveCanonicalQuestionFirstDossier(ENTITY_ID, null)
  const dossier = canonical.dossier && typeof canonical.dossier === 'object' ? canonical.dossier as Record<string, any> : null
  const questions = Array.isArray(dossier?.questions) ? dossier.questions as Array<Record<string, any>> : []
  const questionMap = new Map(questions.map((question) => [toText(question?.question_id), question]))

  const { run } = await getEntityPipelineRun(BATCH_ID, ENTITY_ID)
  const lifecycle = run
    ? await deriveEntityPipelineLifecycle({ entityId: ENTITY_ID, run })
    : null

  const runMetadata = run?.metadata && typeof run.metadata === 'object'
    ? run.metadata as Record<string, any>
    : {}
  const publicationStatus = toText(runMetadata.publication_status || lifecycle?.publication_status) || 'n/a'
  const publicationMode = toText(runMetadata.publication_mode || lifecycle?.publication_mode) || 'n/a'
  const reconcileRequired = Boolean(
    runMetadata.reconcile_required
    ?? lifecycle?.reconcile_required
    ?? false
  )
  const runType = formatRunType(publicationMode)
  const publicationHealth = formatPublicationHealth(publicationStatus, reconcileRequired)
  const repairState = toText(runMetadata.repair_state || lifecycle?.repair_state) || 'idle'
  const repairRetryCount = Number(runMetadata.repair_retry_count ?? lifecycle?.repair_retry_count ?? 0)
  const repairRetryBudget = Number(runMetadata.repair_retry_budget ?? lifecycle?.repair_retry_budget ?? 0)
  const nextRepairQuestionId = toText(runMetadata.next_repair_question_id || lifecycle?.next_repair_question_id) || 'n/a'
  const reconciliationState = toText(runMetadata.reconciliation_state || lifecycle?.reconciliation_state) || 'healthy'

  const targetQuestions = [
    'q11_decision_owner',
    'q12_connections',
    'q15_outreach_strategy',
    'q7_procurement_signal',
    'q8_explicit_rfp',
    'q13_capability_gap',
    'q14_yp_fit',
  ]

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <Badge className="border border-sky-400/30 bg-sky-500/10 text-sky-200">Live repair verification</Badge>
          <h1 className="text-4xl font-semibold tracking-tight">FC Porto degraded publication check</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            This page is the narrow operator path for the live repair proof. It links the canonical dossier, the degraded repair run detail, and the home dashboard in one place so the checks are easy to follow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-amber-400 text-black hover:bg-amber-300">
              <Link href={`/entity-browser/${ENTITY_ID}/dossier?from=1`}>
                Open Canonical dossier
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href={`/entity-import/${BATCH_ID}/${ENTITY_ID}`}>
                Open Run detail
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link href="/">
                Open Home dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Wrench className="h-5 w-5 text-sky-300" />Repair publication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <p>Run type: <span className="font-semibold text-white">{runType}</span></p>
              <p>publication status: <span className="font-semibold text-white">{publicationStatus}</span></p>
              <p>publication mode: <span className="font-semibold text-white">{publicationMode}</span></p>
              <p>Published degraded / healthy: <span className="font-semibold text-white">{publicationHealth}</span></p>
              <p>Reconciliation pending: <span className="font-semibold text-white">{reconcileRequired ? 'Yes' : 'No'}</span></p>
              <p>reconciliation state: <span className="font-semibold text-white">{reconciliationState}</span></p>
              <p>Auto-repair queued / Repairing / Exhausted: <span className="font-semibold text-white">{repairState}</span></p>
              <p>retry budget: <span className="font-semibold text-white">{repairRetryCount}/{repairRetryBudget}</span></p>
              <p>next repair question: <span className="font-semibold text-white">{nextRepairQuestionId}</span></p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-amber-300" />Canonical dossier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <p>source: <span className="font-semibold text-white">{toText(canonical.source) || 'n/a'}</span></p>
              <p>quality state: <span className="font-semibold text-white">{toText(dossier?.quality_state) || 'n/a'}</span></p>
              <p>quality summary: <span className="font-semibold text-white">{toText(dossier?.quality_summary) || 'n/a'}</span></p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Gauge className="h-5 w-5 text-emerald-300" />What to confirm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <p>1. Dossier shows repair recommendations by blocker chain.</p>
              <p>2. Run detail shows Repair run, Published degraded, and Reconciliation pending.</p>
              <p>3. Home dashboard queue cards show the same degraded publication labels.</p>
              <p>4. Auto-repair queued / Repairing / Exhausted matches the current retry state.</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Route className="h-5 w-5 text-sky-300" />Question chain snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {targetQuestions.map((questionId) => {
              const question = questionMap.get(questionId)
              return (
                <div key={questionId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{questionId}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{getQuestionState(question)}</p>
                    </div>
                    {getQuestionState(question).toLowerCase() === 'answered' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{getQuestionSummary(question)}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
