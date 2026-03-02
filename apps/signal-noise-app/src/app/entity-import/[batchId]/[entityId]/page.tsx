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

  const hopTimings = Array.isArray(performanceSummary?.hop_timings)
    ? (performanceSummary?.hop_timings as Array<Record<string, unknown>>)
    : []

  const slowestHop = typeof performanceSummary?.slowest_hop === 'object' && performanceSummary?.slowest_hop !== null
    ? (performanceSummary.slowest_hop as Record<string, unknown>)
    : null

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
              <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                <p>total duration: {String(performanceSummary.total_duration_ms ?? 'n/a')}ms</p>
                <p>iterations with timings: {String(performanceSummary.iterations_with_timings ?? 0)}</p>
                <p>slowest hop: {String(slowestHop?.hop_type ?? 'n/a')}</p>
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
