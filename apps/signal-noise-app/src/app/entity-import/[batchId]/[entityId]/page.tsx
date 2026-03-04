import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEntityPipelineRun } from '@/lib/entity-import-jobs'

export const dynamic = 'force-dynamic'

type PhaseDetail = {
  status?: string
  error?: string
  reason?: string
  [key: string]: unknown
}

export default async function EntityImportRunDetailPage(
  { params }: { params: { batchId: string; entityId: string } },
) {
  const { batch, run } = await getEntityPipelineRun(params.batchId, params.entityId)

  if (!batch || !run) {
    notFound()
  }

  const phaseMap = typeof run.metadata?.phases === 'object' && run.metadata?.phases !== null
    ? (run.metadata.phases as Record<string, PhaseDetail>)
    : {}

  const performanceSummary = typeof run.metadata?.performance_summary === 'object' && run.metadata?.performance_summary !== null
    ? (run.metadata.performance_summary as Record<string, unknown>)
    : null
  const discoveryContext = typeof run.metadata?.discovery_context === 'object' && run.metadata?.discovery_context !== null
    ? (run.metadata.discovery_context as Record<string, unknown>)
    : null
  const monitoringSummary = typeof run.metadata?.monitoring_summary === 'object' && run.metadata?.monitoring_summary !== null
    ? (run.metadata.monitoring_summary as Record<string, unknown>)
    : null
  const escalationReason = typeof run.metadata?.escalation_reason === 'string'
    ? run.metadata.escalation_reason
    : null
  const candidateTypes = typeof monitoringSummary?.candidate_types === 'object' && monitoringSummary?.candidate_types !== null
    ? (monitoringSummary.candidate_types as Record<string, unknown>)
    : null
  const validatedCandidateTypes = typeof monitoringSummary?.validated_candidate_types === 'object' && monitoringSummary?.validated_candidate_types !== null
    ? (monitoringSummary.validated_candidate_types as Record<string, unknown>)
    : null
  const scores = typeof run.metadata?.scores === 'object' && run.metadata?.scores !== null
    ? (run.metadata.scores as Record<string, unknown>)
    : null
  const maturityBreakdown = typeof scores?.breakdown === 'object' && scores?.breakdown !== null
    ? ((scores.breakdown as Record<string, unknown>).maturity as Record<string, unknown> | undefined)
    : null
  const probabilityBreakdown = typeof scores?.breakdown === 'object' && scores?.breakdown !== null
    ? ((scores.breakdown as Record<string, unknown>).probability as Record<string, unknown> | undefined)
    : null
  const batchMetadata = typeof batch.metadata === 'object' && batch.metadata !== null
    ? (batch.metadata as Record<string, unknown>)
    : {}
  const runMetadata = typeof run.metadata === 'object' && run.metadata !== null
    ? (run.metadata as Record<string, unknown>)
    : {}
  const livePhaseDetails = typeof runMetadata.phase_details === 'object' && runMetadata.phase_details !== null
    ? (runMetadata.phase_details as Record<string, unknown>)
    : null
  const phase0Substeps = typeof livePhaseDetails?.phase0_substeps === 'object' && livePhaseDetails.phase0_substeps !== null
    ? (livePhaseDetails.phase0_substeps as Record<string, unknown>)
    : null

  const hopTimings = Array.isArray(performanceSummary?.hop_timings)
    ? (performanceSummary?.hop_timings as Array<Record<string, unknown>>)
    : []

  const slowestHop = typeof performanceSummary?.slowest_hop === 'object' && performanceSummary?.slowest_hop !== null
    ? (performanceSummary.slowest_hop as Record<string, unknown>)
    : null

  const slowestIteration = typeof performanceSummary?.slowest_iteration === 'object' && performanceSummary?.slowest_iteration !== null
    ? (performanceSummary.slowest_iteration as Record<string, unknown>)
    : null

  const discoveryPhase = typeof phaseMap.discovery === 'object' && phaseMap.discovery !== null
    ? phaseMap.discovery
    : null
  const dossierPhase = typeof phaseMap.dossier_generation === 'object' && phaseMap.dossier_generation !== null
    ? phaseMap.dossier_generation
    : null
  const dossierSourceTimings = typeof dossierPhase?.source_timings === 'object' && dossierPhase?.source_timings !== null
    ? (dossierPhase.source_timings as Record<string, unknown>)
    : null

  const budgetExceeded = Boolean(discoveryPhase?.budget_exceeded)
  const timeoutMode = discoveryPhase?.timeout_mode ? String(discoveryPhase.timeout_mode) : 'n/a'
  const budgetSeconds = discoveryPhase?.budget_seconds ? String(discoveryPhase.budget_seconds) : 'n/a'
  const discoveryStopReason = discoveryPhase?.stop_reason ? String(discoveryPhase.stop_reason) : 'n/a'
  const validationTimeoutMs = hopTimings.length
    ? Math.max(...hopTimings.map((hop) => Number(hop.validation_ms ?? 0)))
    : 0

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Import run detail
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{run.entity_name}</h1>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p>batch: {batch.id}</p>
            <p>entityId: {run.entity_id}</p>
            <p>status: {run.status}</p>
            <p>phase: {run.phase}</p>
            <p>sales readiness: {run.sales_readiness ?? 'Pending'}</p>
            <p>rfp count: {run.rfp_count}</p>
            <p>queue mode: {String(batchMetadata.queue_mode ?? 'n/a')}</p>
            <p>worker id: {String(batchMetadata.worker_id ?? 'n/a')}</p>
            <p>heartbeat: {String(batchMetadata.heartbeat_at ?? 'n/a')}</p>
            <p>attempt count: {String(runMetadata.attempt_count ?? batchMetadata.attempt_count ?? 'n/a')}</p>
            <p>retry state: {String(runMetadata.retry_state ?? batchMetadata.retry_state ?? 'n/a')}</p>
            <p>lease owner: {String(runMetadata.lease_owner ?? batchMetadata.worker_id ?? 'n/a')}</p>
            <p>lease expires: {String(runMetadata.lease_expires_at ?? batchMetadata.lease_expires_at ?? 'n/a')}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/entity-import"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Back to import page
            </Link>
            {run.dossier_id ? (
              <Link
                href={`/entity-browser/${run.entity_id}/dossier?from=1`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Open dossier
              </Link>
            ) : null}
            <Link
              href="/rfps"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Open RFP page
            </Link>
          </div>

          {run.error_message ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {run.error_message}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Dossier phase</h2>
          {phase0Substeps ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phase 0 substeps</p>
              <p className="mt-1">current: {String(livePhaseDetails?.current_substep ?? 'n/a')}</p>
              <ul className="mt-2 space-y-1">
                {Object.entries(phase0Substeps).map(([step, value]) => {
                  const detail = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
                  return (
                    <li key={step}>
                      {step}: {String(detail?.status ?? 'unknown')}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Generation timing</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {String(dossierPhase?.duration_seconds ?? 'n/a')}s
              </p>
              <p className="mt-1">collection time: {String(dossierPhase?.collection_time_seconds ?? 'n/a')}s</p>
              <p>tier: {String(dossierPhase?.tier ?? 'n/a')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source coverage</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {String(dossierPhase?.source_count ?? 'n/a')}
              </p>
              <p className="mt-1">sources: {Array.isArray(dossierPhase?.sources_used) ? dossierPhase?.sources_used.join(', ') : 'n/a'}</p>
              <p>hypotheses extracted: {String(dossierPhase?.hypothesis_count ?? 'n/a')}</p>
              <p>source timings:</p>
              {dossierSourceTimings ? (
                <ul className="mt-1 space-y-1">
                  {Object.entries(dossierSourceTimings).map(([key, value]) => {
                    const timing = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
                    const stepTimings = typeof timing?.steps === 'object' && timing.steps !== null
                      ? Object.entries(timing.steps as Record<string, unknown>)
                          .map(([step, duration]) => `${step}:${String(duration)}s`)
                          .join(', ')
                      : null
                    return (
                      <li key={key}>
                        {key}: {String(timing?.duration_seconds ?? 'n/a')}s ({String(timing?.status ?? timing?.outcome ?? 'n/a')})
                        {stepTimings ? ` [${stepTimings}]` : ''}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>n/a</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Baseline monitoring</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Monitoring summary</p>
              <p className="mt-2">pages fetched: {String(monitoringSummary?.pages_fetched ?? 'n/a')}</p>
              <p>pages changed: {String(monitoringSummary?.pages_changed ?? 'n/a')}</p>
              <p>pages unchanged: {String(monitoringSummary?.pages_unchanged ?? 'n/a')}</p>
              <p>candidate count: {String(monitoringSummary?.candidate_count ?? 'n/a')}</p>
              <p>snapshot count: {String(monitoringSummary?.snapshot_count ?? 'n/a')}</p>
              <p>candidate types: {candidateTypes ? Object.entries(candidateTypes).map(([key, value]) => `${key}:${String(value)}`).join(', ') : 'n/a'}</p>
              <p>validated candidate types: {validatedCandidateTypes ? Object.entries(validatedCandidateTypes).map(([key, value]) => `${key}:${String(value)}`).join(', ') : 'n/a'}</p>
              <p>LLM validated: {String(monitoringSummary?.llm_validated_count ?? 'n/a')}</p>
              <p>escalation recommended: {String(monitoringSummary?.escalation_recommended_count ?? 'n/a')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Escalation reason</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {escalationReason ?? 'None'}
              </p>
              <p className="mt-1">default path: baseline monitoring</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Discovery summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Template</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {String(discoveryContext?.template_id ?? 'n/a')}
              </p>
              <p className="mt-1">lead hypothesis: {String(discoveryContext?.lead_hypothesis_id ?? 'n/a')}</p>
              <p>pattern: {String(discoveryContext?.lead_pattern_name ?? 'n/a')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Active hypothesis</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {String(discoveryContext?.slowest_hypothesis_id ?? discoveryContext?.lead_hypothesis_id ?? 'n/a')}
              </p>
              <p className="mt-1">slowest hop type: {String(discoveryContext?.slowest_hop_type ?? 'n/a')}</p>
              <p>lead confidence: {String(discoveryContext?.lead_confidence ?? 'n/a')}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Score weighting</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Maturity weighting</p>
              <p className="mt-2">validated signals: {String(maturityBreakdown?.validated_signal_weight ?? 'n/a')}</p>
              <p>temporal evidence: {String(maturityBreakdown?.temporal_weight ?? 'n/a')}</p>
              <p>hypothesis prior: {String(maturityBreakdown?.hypothesis_prior_weight ?? 'n/a')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Probability weighting</p>
              <p className="mt-2">validated signals: {String(probabilityBreakdown?.validated_signal_weight ?? 'n/a')}</p>
              <p>temporal evidence: {String(probabilityBreakdown?.temporal_weight ?? 'n/a')}</p>
              <p>hypothesis prior: {String(probabilityBreakdown?.hypothesis_prior_weight ?? 'n/a')}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Phase status</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Object.entries(phaseMap).map(([phaseName, detail]) => (
              <div key={phaseName} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{phaseName}</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{detail.status ?? 'unknown'}</p>
                {detail.reason ? <p className="mt-1 text-sm text-slate-600">reason: {detail.reason}</p> : null}
                {detail.error ? <p className="mt-1 text-sm text-red-600">{detail.error}</p> : null}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {Object.entries(detail)
                    .filter(([key]) => !['status', 'reason', 'error'].includes(key))
                    .map(([key, value]) => (
                      <p key={key}>{key}: {String(value)}</p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Discovery timing</h2>
          {performanceSummary ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-4">
                <p>total duration: {String(performanceSummary.total_duration_ms ?? 'n/a')}ms</p>
                <p>iterations with timings: {String(performanceSummary.iterations_with_timings ?? 0)}</p>
                <p>slowest hop: {String(slowestHop?.hop_type ?? 'n/a')}</p>
                <p>validation timeout: {validationTimeoutMs}ms</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Budget exceeded</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{budgetExceeded ? 'Yes' : 'No'}</p>
                  <p className="mt-1">timeout mode: {timeoutMode}</p>
                  <p>budget seconds: {budgetSeconds}</p>
                  <p>stop reason: {discoveryStopReason}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Slowest iteration</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {String(slowestIteration?.iteration ?? 'n/a')}
                  </p>
                  <p className="mt-1">hop type: {String(slowestIteration?.hop_type ?? 'n/a')}</p>
                  <p>hypothesis: {String(slowestIteration?.hypothesis_id ?? 'n/a')}</p>
                </div>
              </div>
              {slowestHop ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  slowest hop: {String(slowestHop.hop_type)} in iteration {String(slowestHop.iteration)} at {String(slowestHop.duration_ms)}ms
                </div>
              ) : null}
              {hopTimings.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-4">Iteration</th>
                        <th className="py-2 pr-4">Hop</th>
                        <th className="py-2 pr-4">Decision</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-4">URL</th>
                        <th className="py-2 pr-4">Scrape</th>
                        <th className="py-2 pr-4">Eval</th>
                        <th className="py-2 pr-4">Validation</th>
                        <th className="py-2 pr-4">Scrape cache</th>
                        <th className="py-2 pr-4">Eval cache</th>
                        <th className="py-2 pr-4">Content hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hopTimings.map((hop, index) => (
                        <tr key={`${String(hop.hop_type)}-${index}`} className="border-b border-slate-100">
                          <td className="py-2 pr-4">{String(hop.iteration ?? '')}</td>
                          <td className="py-2 pr-4">{String(hop.hop_type ?? '')}</td>
                          <td className="py-2 pr-4">{String(hop.decision ?? '')}</td>
                          <td className="py-2 pr-4">{String(hop.duration_ms ?? '')}ms</td>
                          <td className="py-2 pr-4">{String(hop.url_resolution_ms ?? '')}ms</td>
                          <td className="py-2 pr-4">{String(hop.scrape_ms ?? '')}ms</td>
                          <td className="py-2 pr-4">{String(hop.evaluation_ms ?? '')}ms</td>
                          <td className="py-2 pr-4">{String(hop.validation_ms ?? '')}ms</td>
                          <td className="py-2 pr-4">{String(hop.scrape_cache_hit ?? '')}</td>
                          <td className="py-2 pr-4">{String(hop.evaluation_cache_hit ?? '')}</td>
                          <td className="py-2 pr-4">{String(hop.content_hash ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-600">No hop timings recorded for this run.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Discovery timing will appear once the discovery result is persisted.</p>
          )}
        </section>
      </div>
    </main>
  )
}
